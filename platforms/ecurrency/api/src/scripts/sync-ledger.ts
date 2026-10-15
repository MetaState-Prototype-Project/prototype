import "reflect-metadata";
import path from "node:path";
import { config } from "dotenv";

config({ path: path.resolve(__dirname, "../../../../../.env") });

import { AppDataSource } from "../database/data-source";
import { Group } from "../database/entities/Group";
import { AccountType, Ledger } from "../database/entities/Ledger";
import { User } from "../database/entities/User";
import { adapter } from "../web3adapter";

// Checks that every eCurrency ledger row is in the eVault of each party to it
// (sender and receiver, the same rule the live subscriber uses) and, with
// --apply, writes whatever is missing and re-checks it.
//
// The live sync is fire-and-forget: a row is pushed 3s after insert and again
// after its hash is saved, failures are only logged, and a restart inside that
// window drops it. So rows can be missing, or present only as the first,
// hash-less copy. This script compares the database with what each eVault
// actually returns over GraphQL (not the mapping DB, which can claim a sync
// that never landed).
//
// Usage (from platforms/ecurrency/api, with the production .env):
//   pnpm sync:ledger                      check only, writes nothing
//   pnpm sync:ledger --apply              write missing/outdated copies, then verify
//   pnpm sync:ledger --only=@<ename>      limit to one eVault
//   pnpm sync:ledger --settle=300         ignore rows newer than 300s (default 120)
//
// Exit code 0 means every row is verified present in every party's eVault.
// One vault failing never stops the others. eNames the Registry has no eVault
// for (deleted or never provisioned) are listed as skipped, not as failures,
// since there is nowhere to write to.

const LEDGER_ONTOLOGY = "550e8400-e29b-41d4-a716-446655440006";
const REGISTRY_URL =
    process.env.PUBLIC_REGISTRY_URL ?? "https://registry.w3ds.metastate.foundation";
// The platform the live adapter certifies as (see web3adapter/watchers/subscriber.ts).
const PLATFORM = process.env.VITE_ECURRENCY_BASE_URL;

const args = process.argv.slice(2);
const flag = (name: string) => args.find((a) => a.startsWith(`--${name}=`))?.split("=")[1];
const APPLY = args.includes("--apply");
const ONLY = flag("only") ? normalizeEname(flag("only") as string) : null;
const SETTLE_MS = Number(flag("settle") ?? 120) * 1000;
const VAULT_CONCURRENCY = 3;

function normalizeEname(value: string): string {
    return value.startsWith("@") ? value : `@${value}`;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** The Registry has no eVault for this eName (deleted or never provisioned). */
class NoEVaultError extends Error {}

// ─── Registry ────────────────────────────────────────────────────────────────

let token: { value: string; expiresAt: number } | null = null;

/** Platform token from the Registry's /platforms/certification. */
async function platformToken(force = false): Promise<string> {
    if (!force && token && token.expiresAt - Date.now() > 60_000) return token.value;
    const res = await fetch(new URL("/platforms/certification", REGISTRY_URL), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform: PLATFORM }),
        signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) throw new Error(`/platforms/certification responded ${res.status}`);
    const body = (await res.json()) as { token: string; expiresAt?: number };
    token = { value: body.token, expiresAt: body.expiresAt ?? Date.now() + 3_600_000 };
    return token.value;
}

const endpoints = new Map<string, string>();

/** The vault's GraphQL endpoint; retries transient Registry errors, not a 404. */
async function graphqlUrl(ename: string): Promise<string> {
    const cached = endpoints.get(ename);
    if (cached) return cached;
    for (let attempt = 1; ; attempt++) {
        let res: Response;
        try {
            res = await fetch(
                new URL(`/resolve?w3id=${encodeURIComponent(ename)}`, REGISTRY_URL),
                { signal: AbortSignal.timeout(15_000) },
            );
        } catch (error) {
            if (attempt >= 3) throw error;
            await sleep(1000 * 2 ** attempt);
            continue;
        }
        if (res.status === 404) throw new NoEVaultError("no eVault registered");
        if (!res.ok) {
            if (attempt >= 3) throw new Error(`Registry could not resolve ${ename} (${res.status})`);
            await sleep(1000 * 2 ** attempt);
            continue;
        }
        const body = (await res.json()) as { uri?: string; evaultUrl?: string };
        const uri = body.uri ?? body.evaultUrl;
        if (!uri) throw new NoEVaultError("Registry returned no eVault");
        const url = new URL("/graphql", uri).toString();
        endpoints.set(ename, url);
        return url;
    }
}

// ─── eVault ──────────────────────────────────────────────────────────────────

/** One GraphQL call against a vault; retries rate limits, 5xx and network errors. */
async function graphql<T>(ename: string, query: string, variables: object): Promise<T> {
    let refreshed = false;
    const url = await graphqlUrl(ename);
    for (let attempt = 1; ; attempt++) {
        let res: Response;
        try {
            res = await fetch(url, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${await platformToken()}`,
                    "X-ENAME": ename,
                },
                body: JSON.stringify({ query, variables }),
                signal: AbortSignal.timeout(30_000),
            });
        } catch (error) {
            if (attempt >= 5) throw error;
            await sleep(1000 * 2 ** attempt);
            continue;
        }
        if (res.status === 401 && !refreshed) {
            refreshed = true;
            await platformToken(true);
            continue;
        }
        if ((res.status === 429 || res.status >= 500) && attempt < 5) {
            const retryAfter = Number(res.headers.get("retry-after"));
            await sleep(retryAfter > 0 ? retryAfter * 1000 : 1000 * 2 ** attempt);
            continue;
        }
        const body = (await res.json().catch(() => null)) as {
            data?: T;
            errors?: { message: string }[];
        } | null;
        if (!res.ok || !body) throw new Error(`${ename} responded ${res.status}`);
        if (body.errors?.length) {
            throw new Error(`${ename}: ${body.errors.map((e) => e.message).join("; ")}`);
        }
        return body.data as T;
    }
}

interface VaultRecord {
    id: string;
    parsed: Record<string, unknown>;
}

async function listLedger(ename: string): Promise<VaultRecord[]> {
    const out: VaultRecord[] = [];
    let after: string | null = null;
    do {
        const data: {
            metaEnvelopes: {
                edges: { node: VaultRecord }[];
                pageInfo: { hasNextPage: boolean; endCursor: string | null };
            };
        } = await graphql(
            ename,
            `query ($first: Int!, $after: String, $filter: MetaEnvelopeFilterInput) {
                metaEnvelopes(first: $first, after: $after, filter: $filter) {
                    edges { node { id parsed } }
                    pageInfo { hasNextPage endCursor }
                }
            }`,
            { first: 100, after, filter: { ontologyId: LEDGER_ONTOLOGY } },
        );
        out.push(...data.metaEnvelopes.edges.map((e) => e.node));
        after = data.metaEnvelopes.pageInfo.hasNextPage
            ? data.metaEnvelopes.pageInfo.endCursor
            : null;
    } while (after);
    return out;
}

// Same mutations and legacy acl as the live adapter (web3-adapter EVaultClient).
async function storeLedger(ename: string, payload: object): Promise<string> {
    const data: { storeMetaEnvelope: { metaEnvelope: { id: string } } } = await graphql(
        ename,
        `mutation ($input: MetaEnvelopeInput!) {
            storeMetaEnvelope(input: $input) { metaEnvelope { id } }
        }`,
        { input: { ontology: LEDGER_ONTOLOGY, payload, acl: ["*"] } },
    );
    return data.storeMetaEnvelope.metaEnvelope.id;
}

async function updateLedger(ename: string, id: string, payload: object): Promise<void> {
    await graphql(
        ename,
        `mutation ($id: String!, $input: MetaEnvelopeInput!) {
            updateMetaEnvelopeById(id: $id, input: $input) { metaEnvelope { id } }
        }`,
        { id, input: { ontology: LEDGER_ONTOLOGY, payload, acl: ["*"] } },
    );
}

// ─── Expected state ──────────────────────────────────────────────────────────

/** The payload the live adapter writes for a row (ledger.mapping.json). */
async function expectedPayload(row: Ledger): Promise<Record<string, unknown>> {
    const currencyGlobalId = await adapter.mappingDb.getGlobalId(row.currencyId);
    return {
        currencyId: currencyGlobalId ?? row.currencyId,
        accountId: row.accountId,
        accountType: row.accountType,
        amount: row.amount,
        type: row.type,
        description: row.description,
        senderAccountId: row.senderAccountId,
        senderAccountType: row.senderAccountType,
        receiverAccountId: row.receiverAccountId,
        receiverAccountType: row.receiverAccountType,
        balance: row.balance,
        hash: row.hash,
        prevHash: row.prevHash,
        createdAt: row.createdAt.toISOString(),
    };
}

/** Same createdAt, or off by a whole timezone offset (timestamp columns are zone-less). */
function sameInstant(a: unknown, b: Date): boolean {
    const t = Date.parse(String(a));
    if (Number.isNaN(t)) return false;
    const diff = Math.abs(t - b.getTime());
    return diff === 0 || (diff % (15 * 60_000) === 0 && diff <= 14 * 3_600_000);
}

/** A vault record is a copy of this row: by hash, or by what identifies the entry. */
function isCopyOf(record: Record<string, unknown>, row: Ledger): boolean {
    if (row.hash && record.hash === row.hash) return true;
    if (record.hash && record.hash !== row.hash) return false;
    return (
        record.accountId === row.accountId &&
        record.type === row.type &&
        Number(record.amount) === Number(row.amount) &&
        (record.balance === undefined ||
            record.balance === null ||
            Number(record.balance) === Number(row.balance)) &&
        sameInstant(record.createdAt, row.createdAt)
    );
}

/** Complete: carries the row's hash (rows from before hashing have none to carry). */
const isComplete = (record: Record<string, unknown>, row: Ledger) =>
    !row.hash || record.hash === row.hash;

type Status = "synced" | "outdated" | "missing";

function classify(records: VaultRecord[], row: Ledger) {
    const copies = records.filter((r) => isCopyOf(r.parsed, row));
    const complete = copies.find((r) => isComplete(r.parsed, row));
    const status: Status = complete ? "synced" : copies.length ? "outdated" : "missing";
    return { status, copies, best: complete ?? copies[0] ?? null };
}

// ─── Run ─────────────────────────────────────────────────────────────────────

interface VaultReport {
    ename: string;
    expected: number;
    synced: number;
    outdated: number;
    missing: number;
    duplicates: number;
    created: number;
    updated: number;
    stillUnsynced: string[];
    error?: string;
    /** No eVault exists for this eName, so there is nowhere to write; not a failure. */
    skipped?: string;
}

async function syncVault(ename: string, rows: Ledger[]): Promise<VaultReport> {
    const report: VaultReport = {
        ename,
        expected: rows.length,
        synced: 0,
        outdated: 0,
        missing: 0,
        duplicates: 0,
        created: 0,
        updated: 0,
        stillUnsynced: [],
    };
    try {
        const records = await listLedger(ename);
        const work: { row: Ledger; status: Status; target: string | null }[] = [];
        for (const row of rows) {
            const { status, copies, best } = classify(records, row);
            report[status]++;
            if (copies.length > 1) report.duplicates += copies.length - 1;
            if (status !== "synced") work.push({ row, status, target: best?.id ?? null });
            else if (APPLY && best) await remember(row, ename, best.id);
        }

        if (APPLY) {
            for (const { row, status, target } of work) {
                const payload = await expectedPayload(row);
                try {
                    if (status === "outdated" && target) {
                        await updateLedger(ename, target, payload);
                        await remember(row, ename, target);
                        report.updated++;
                    } else {
                        const id = await storeLedger(ename, payload);
                        await remember(row, ename, id);
                        report.created++;
                    }
                } catch (error) {
                    console.error(`[SYNC] ${ename} row ${row.id}: ${(error as Error).message}`);
                }
            }

            // Verify against the vault itself, not against what was sent.
            const after = await listLedger(ename);
            report.stillUnsynced = rows
                .filter((row) => classify(after, row).status !== "synced")
                .map((row) => row.id);
        } else {
            report.stillUnsynced = work.map((w) => w.row.id);
        }
    } catch (error) {
        if (error instanceof NoEVaultError) report.skipped = error.message;
        else report.error = (error as Error).message;
        report.stillUnsynced = rows.map((r) => r.id);
    }
    return report;
}

/** Point the live adapter's mapping at the copy that is really in the vault. */
async function remember(row: Ledger, ename: string, globalId: string): Promise<void> {
    const localId = `${row.id}::${ename}`;
    const current = await adapter.mappingDb.getGlobalId(localId);
    if (current === globalId) return;
    try {
        if (current) await adapter.mappingDb.deleteMapping(localId);
        await adapter.mappingDb.storeMapping({ localId, globalId });
    } catch (error) {
        console.warn(`[SYNC] mapping ${localId}: ${(error as Error).message}`);
    }
}

async function main() {
    if (!PLATFORM) throw new Error("VITE_ECURRENCY_BASE_URL is not set");
    console.log(
        `[SYNC] eCurrency ledger → eVaults, ${APPLY ? "APPLY (writes enabled)" : "CHECK ONLY (no writes)"}`,
    );
    console.log(`[SYNC] Registry ${REGISTRY_URL}, certifying as ${PLATFORM}`);

    await AppDataSource.initialize();
    await platformToken();

    const users = await AppDataSource.getRepository(User).find();
    const groups = await AppDataSource.getRepository(Group).find();
    const enameOf = new Map<string, string | null>();
    for (const u of users) enameOf.set(`user:${u.id}`, u.ename ? normalizeEname(u.ename) : null);
    for (const g of groups) enameOf.set(`group:${g.id}`, g.ename ? normalizeEname(g.ename) : null);

    const cutoff = new Date(Date.now() - SETTLE_MS);
    const rows = (
        await AppDataSource.getRepository(Ledger).find({ order: { createdAt: "ASC" } })
    ).filter((row) => row.createdAt <= cutoff);

    // Parties per row, exactly as the subscriber resolves them.
    const byVault = new Map<string, Ledger[]>();
    let noParties = 0;
    const unnamed = new Set<string>();
    for (const row of rows) {
        const parties = new Set<string>();
        for (const [id, type] of [
            [row.senderAccountId, row.senderAccountType],
            [row.receiverAccountId, row.receiverAccountType],
        ] as [string | null, AccountType | null][]) {
            if (!id || !type) continue;
            const ename = enameOf.get(`${type}:${id}`);
            if (ename) parties.add(ename);
            else unnamed.add(`${type}:${id}`);
        }
        if (parties.size === 0) noParties++;
        for (const ename of parties) {
            if (ONLY && ename !== ONLY) continue;
            byVault.set(ename, [...(byVault.get(ename) ?? []), row]);
        }
    }

    console.log(
        `[SYNC] ${rows.length} ledger rows, ${byVault.size} eVaults to check` +
            (noParties ? `, ${noParties} rows with no parties (not synced by design, e.g. "Account initialized")` : "") +
            (unnamed.size ? `, ${unnamed.size} accounts with no eName (cannot be synced)` : ""),
    );

    const vaults = [...byVault.entries()];
    const reports: VaultReport[] = [];
    const inFlight = new Set<string>();
    const heartbeat = setInterval(() => {
        console.log(
            `[SYNC] … ${reports.length}/${vaults.length} vaults done, still working on: ${[...inFlight].join(", ")}`,
        );
    }, 30_000);
    let next = 0;
    await Promise.all(
        Array.from({ length: VAULT_CONCURRENCY }, async () => {
            while (next < vaults.length) {
                const [ename, vaultRows] = vaults[next++];
                inFlight.add(ename);
                const r = await syncVault(ename, vaultRows);
                inFlight.delete(ename);
                reports.push(r);
                if (r.skipped) {
                    console.log(`[SYNC] ${ename}: ${r.expected} rows · SKIPPED, ${r.skipped}`);
                    continue;
                }
                const verdict = r.error
                    ? `ERROR ${r.error}`
                    : r.stillUnsynced.length
                      ? `✗ ${r.stillUnsynced.length} unsynced`
                      : "✓ verified";
                console.log(
                    `[SYNC] ${ename}: ${r.expected} rows · ${r.synced} synced · ${r.missing} missing · ${r.outdated} outdated` +
                        (r.duplicates ? ` · ${r.duplicates} duplicate copies` : "") +
                        (APPLY ? ` → created ${r.created}, updated ${r.updated}` : "") +
                        ` · ${verdict}`,
                );
            }
        }),
    );
    clearInterval(heartbeat);

    const sum = (k: "expected" | "synced" | "missing" | "outdated" | "duplicates" | "created" | "updated") =>
        checked.reduce((s, r) => s + r[k], 0);
    const skipped = reports.filter((r) => r.skipped);
    const checked = reports.filter((r) => !r.skipped);
    const failed = checked.filter((r) => r.error || r.stillUnsynced.length);
    console.log("[SYNC] ==========================================");
    console.log(`[SYNC] Row copies expected  : ${sum("expected")}`);
    console.log(`[SYNC] Already synced       : ${sum("synced")}`);
    console.log(`[SYNC] Missing              : ${sum("missing")}`);
    console.log(`[SYNC] Outdated (no hash)   : ${sum("outdated")}`);
    console.log(`[SYNC] Duplicate copies     : ${sum("duplicates")} (reported, never deleted)`);
    if (APPLY) {
        console.log(`[SYNC] Created              : ${sum("created")}`);
        console.log(`[SYNC] Updated in place     : ${sum("updated")}`);
    }
    console.log(
        `[SYNC] Vaults fully in sync : ${checked.length - failed.length}/${checked.length}` +
            (APPLY ? " (re-read from each eVault after writing)" : ""),
    );
    for (const r of failed) {
        console.log(
            `[SYNC]   ${r.ename}: ${r.error ?? `${r.stillUnsynced.length} rows unsynced: ${r.stillUnsynced.slice(0, 5).join(", ")}${r.stillUnsynced.length > 5 ? ", …" : ""}`}`,
        );
    }
    if (skipped.length) {
        console.log(
            `[SYNC] Skipped, no eVault   : ${skipped.length} eNames (${skipped.reduce((s, r) => s + r.expected, 0)} row copies), nothing to sync to`,
        );
        for (const r of skipped) console.log(`[SYNC]   ${r.ename}: ${r.skipped}`);
    }
    console.log("[SYNC] ==========================================");

    await AppDataSource.destroy();
    return failed.length === 0;
}

main()
    .then((ok) => process.exit(ok ? 0 : 1))
    .catch((error) => {
        console.error("[SYNC] Fatal:", error);
        process.exit(1);
    });
