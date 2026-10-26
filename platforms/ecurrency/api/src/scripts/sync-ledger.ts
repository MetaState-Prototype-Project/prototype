import "reflect-metadata";
import path from "node:path";
import { config } from "dotenv";

config({ path: path.resolve(__dirname, "../../../../../.env") });

import { AppDataSource } from "../database/data-source";
import { Currency } from "../database/entities/Currency";
import { Group } from "../database/entities/Group";
import { AccountType, Ledger } from "../database/entities/Ledger";
import { User } from "../database/entities/User";
import { adapter } from "../web3adapter";

// Checks that every eCurrency ledger row is in the eVault of each party to it
// (sender and receiver, the same rule the live subscriber uses; a mint, burn
// or "Account initialized" has none, so it goes to its holder's vault) and,
// with --apply, writes whatever is missing and re-checks it.
//
// The live sync is fire-and-forget: a row is pushed 3s after insert and again
// after its hash is saved, failures are only logged, and a restart inside that
// window drops it. So rows can be missing, or present only as the first,
// hash-less copy. This script compares the database with what each eVault
// actually returns over GraphQL (not the mapping DB, which can claim a sync
// that never landed).
//
// Each currency's own record must exist too (in its creator's eVault, as the
// adapter writes it), or the ledger entries point at an internal id nothing
// else can resolve. A copy that carries the wrong currency id is outdated.
//
// It also syncs each holder's Account records (one per holder and currency,
// the shape scripts/backfill-accounts.ts writes). The live adapter never
// writes or updates these, so they go missing for new holders and their
// balance goes stale after every transaction.
//
// Usage (from platforms/ecurrency/api, with the production .env):
//   pnpm sync:ledger                      check only, writes nothing
//   pnpm sync:ledger --apply              write missing/outdated copies, then verify
//   pnpm sync:ledger --only=@<ename>      limit to one eVault
//   pnpm sync:ledger --settle=300         ignore rows newer than 300s (default 120)
//
// Exit code 0 means every row is verified present in every party's eVault and
// every holder's Account record exists with the current balance.
// One vault failing never stops the others. eNames the Registry has no eVault
// for (deleted or never provisioned) are listed as skipped, not as failures,
// since there is nowhere to write to.

const LEDGER_ONTOLOGY = "550e8400-e29b-41d4-a716-446655440006";
const ACCOUNT_ONTOLOGY = "6fda64db-fd14-4fa2-bd38-77d2e5e6136d";
const CURRENCY_ONTOLOGY = "550e8400-e29b-41d4-a716-446655440008";
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

async function list(ename: string, ontology: string): Promise<VaultRecord[]> {
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
            { first: 100, after, filter: { ontologyId: ontology } },
        );
        out.push(...data.metaEnvelopes.edges.map((e) => e.node));
        after = data.metaEnvelopes.pageInfo.hasNextPage
            ? data.metaEnvelopes.pageInfo.endCursor
            : null;
    } while (after);
    return out;
}

// Same mutations and legacy acl as the live adapter (web3-adapter EVaultClient).
async function store(ename: string, ontology: string, payload: object): Promise<string> {
    const data: { storeMetaEnvelope: { metaEnvelope: { id: string } } } = await graphql(
        ename,
        `mutation ($input: MetaEnvelopeInput!) {
            storeMetaEnvelope(input: $input) { metaEnvelope { id } }
        }`,
        { input: { ontology, payload, acl: ["*"] } },
    );
    return data.storeMetaEnvelope.metaEnvelope.id;
}

async function update(ename: string, id: string, ontology: string, payload: object): Promise<void> {
    await graphql(
        ename,
        `mutation ($id: String!, $input: MetaEnvelopeInput!) {
            updateMetaEnvelopeById(id: $id, input: $input) { metaEnvelope { id } }
        }`,
        { id, input: { ontology, payload, acl: ["*"] } },
    );
}

// ─── Expected state ──────────────────────────────────────────────────────────

/** eCurrency currency id → its record's global id, filled once currencies are synced. */
const currencyGlobalIds = new Map<string, string>();
const expectedCurrencyId = (row: Ledger) => currencyGlobalIds.get(row.currencyId) ?? row.currencyId;

/** The payload the live adapter writes for a row (ledger.mapping.json). */
function expectedPayload(row: Ledger): Record<string, unknown> {
    return {
        currencyId: expectedCurrencyId(row),
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

/**
 * Complete: carries the row's hash (rows from before hashing have none to
 * carry) and points at the currency's record, not eCurrency's internal id.
 */
const isComplete = (record: Record<string, unknown>, row: Ledger) =>
    (!row.hash || record.hash === row.hash) && record.currencyId === expectedCurrencyId(row);

type Status = "synced" | "outdated" | "missing";

/** Synced only when every copy is complete: apps may read a stale duplicate. */
function classify(records: VaultRecord[], row: Ledger) {
    const copies = records.filter((r) => isCopyOf(r.parsed, row));
    const stale = copies.filter((r) => !isComplete(r.parsed, row));
    const status: Status = !copies.length ? "missing" : stale.length ? "outdated" : "synced";
    const best = copies.find((r) => isComplete(r.parsed, row)) ?? copies[0] ?? null;
    return { status, copies, stale, best };
}

// ─── Currencies ──────────────────────────────────────────────────────────────

/** The payload the live adapter writes for a currency (currency.mapping.json). */
const currencyPayload = (c: Currency) => ({
    name: c.name,
    description: c.description,
    ename: c.ename,
    groupId: c.groupId,
    allowNegative: c.allowNegative,
    maxNegativeBalance: c.maxNegativeBalance,
    allowNegativeGroupOnly: c.allowNegativeGroupOnly,
    createdBy: c.createdBy,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
});

interface CurrencyReport {
    synced: number;
    missing: number;
    created: number;
    /** Mapped, but the record is not in the creator's eVault (may be in another admin's). */
    elsewhere: string[];
    failed: string[];
}

/**
 * Every currency's record in its creator's eVault. Missing ones are written
 * (with --apply) and mapped, so ledger entries can carry the record's id.
 */
async function syncCurrencies(
    currencies: Currency[],
    enameOf: Map<string, string | null>,
): Promise<CurrencyReport> {
    const report: CurrencyReport = { synced: 0, missing: 0, created: 0, elsewhere: [], failed: [] };
    for (const c of currencies) {
        const label = `${c.name} (${c.ename})`;
        const owner = enameOf.get(`user:${c.createdBy}`);
        const mapped = await adapter.mappingDb.getGlobalId(c.id);
        if (!owner) {
            if (mapped) currencyGlobalIds.set(c.id, mapped);
            report.failed.push(`${label}: creator has no eName`);
            continue;
        }
        try {
            const find = (records: VaultRecord[]) =>
                records.find(
                    (r) =>
                        r.id === mapped ||
                        (typeof r.parsed.ename === "string" &&
                            normalizeEname(r.parsed.ename) === normalizeEname(c.ename)),
                );
            const found = find(await list(owner, CURRENCY_ONTOLOGY));
            if (found) {
                report.synced++;
                currencyGlobalIds.set(c.id, found.id);
                if (APPLY && found.id !== mapped) await rememberId(c.id, found.id);
                continue;
            }
            if (mapped) {
                currencyGlobalIds.set(c.id, mapped);
                report.elsewhere.push(`${label}: mapped to ${mapped}, not in ${owner}`);
                continue;
            }
            report.missing++;
            if (!APPLY) {
                report.failed.push(`${label}: no record in any eVault`);
                continue;
            }
            const id = await store(owner, CURRENCY_ONTOLOGY, currencyPayload(c));
            if (!find(await list(owner, CURRENCY_ONTOLOGY))) {
                report.failed.push(`${label}: written to ${owner} but not there on re-read`);
                continue;
            }
            await rememberId(c.id, id);
            currencyGlobalIds.set(c.id, id);
            report.created++;
            console.log(`[SYNC] currency ${label}: created ${id} in ${owner}`);
        } catch (error) {
            if (mapped) currencyGlobalIds.set(c.id, mapped);
            report.failed.push(`${label}: ${(error as Error).message}`);
        }
    }
    return report;
}

// ─── Accounts ────────────────────────────────────────────────────────────────

/** One holder's account in one currency, as backfill-accounts.ts writes it. */
interface ExpectedAccount {
    key: string;
    payload: {
        accountId: string;
        accountEname: string;
        accountType: AccountType;
        currencyEname: string;
        currencyName: string;
        balance: number;
        createdAt: string;
    };
}

// Currency eNames are unique, so a holder's account is (accountId, currencyEname).
const isAccountCopy = (record: Record<string, unknown>, a: ExpectedAccount) =>
    record.accountId === a.payload.accountId &&
    typeof record.currencyEname === "string" &&
    normalizeEname(record.currencyEname) === a.payload.currencyEname;

const isAccountCurrent = (record: Record<string, unknown>, a: ExpectedAccount) =>
    Number(record.balance) === a.payload.balance &&
    record.accountType === a.payload.accountType &&
    record.currencyName === a.payload.currencyName &&
    typeof record.accountEname === "string" &&
    normalizeEname(record.accountEname) === a.payload.accountEname;

function classifyAccount(records: VaultRecord[], a: ExpectedAccount) {
    const copies = records.filter((r) => isAccountCopy(r.parsed, a));
    const current = copies.find((r) => isAccountCurrent(r.parsed, a));
    const status: Status = current ? "synced" : copies.length ? "outdated" : "missing";
    return { status, copies, best: current ?? copies[0] ?? null };
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
    accounts: {
        expected: number;
        synced: number;
        outdated: number;
        missing: number;
        duplicates: number;
        created: number;
        updated: number;
        stillUnsynced: string[];
    };
    error?: string;
    /** No eVault exists for this eName, so there is nowhere to write; not a failure. */
    skipped?: string;
}

async function syncVault(
    ename: string,
    rows: Ledger[],
    accounts: ExpectedAccount[],
): Promise<VaultReport> {
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
        accounts: {
            expected: accounts.length,
            synced: 0,
            outdated: 0,
            missing: 0,
            duplicates: 0,
            created: 0,
            updated: 0,
            stillUnsynced: [],
        },
    };
    try {
        const records = rows.length ? await list(ename, LEDGER_ONTOLOGY) : [];
        const work: { row: Ledger; stale: string[] }[] = [];
        for (const row of rows) {
            const { status, copies, stale, best } = classify(records, row);
            report[status]++;
            if (copies.length > 1) report.duplicates += copies.length - 1;
            if (status !== "synced") work.push({ row, stale: stale.map((r) => r.id) });
            if (APPLY && best && status !== "missing") await remember(row, ename, best.id);
        }

        if (APPLY) {
            for (const { row, stale } of work) {
                const payload = expectedPayload(row);
                try {
                    if (stale.length) {
                        // Every stale copy, duplicates included, so none is left behind.
                        for (const id of stale) await update(ename, id, LEDGER_ONTOLOGY, payload);
                        report.updated += stale.length;
                    } else {
                        const id = await store(ename, LEDGER_ONTOLOGY, payload);
                        await remember(row, ename, id);
                        report.created++;
                    }
                } catch (error) {
                    console.error(`[SYNC] ${ename} row ${row.id}: ${(error as Error).message}`);
                }
            }

            // Verify against the vault itself, not against what was sent.
            const after = rows.length ? await list(ename, LEDGER_ONTOLOGY) : [];
            report.stillUnsynced = rows
                .filter((row) => classify(after, row).status !== "synced")
                .map((row) => row.id);
        } else {
            report.stillUnsynced = work.map((w) => w.row.id);
        }

        await syncAccounts(ename, accounts, report.accounts);
    } catch (error) {
        if (error instanceof NoEVaultError) report.skipped = error.message;
        else report.error = (error as Error).message;
        report.stillUnsynced = rows.map((r) => r.id);
        report.accounts.stillUnsynced = accounts.map((a) => a.key);
    }
    return report;
}

async function syncAccounts(
    ename: string,
    accounts: ExpectedAccount[],
    report: VaultReport["accounts"],
): Promise<void> {
    if (!accounts.length) return;
    const records = await list(ename, ACCOUNT_ONTOLOGY);
    const work: { account: ExpectedAccount; target: string | null }[] = [];
    for (const account of accounts) {
        const { status, copies, best } = classifyAccount(records, account);
        report[status]++;
        if (copies.length > 1) report.duplicates += copies.length - 1;
        if (status !== "synced") work.push({ account, target: best?.id ?? null });
    }
    if (!APPLY) {
        report.stillUnsynced = work.map((w) => w.account.key);
        return;
    }
    for (const { account, target } of work) {
        try {
            if (target) {
                await update(ename, target, ACCOUNT_ONTOLOGY, account.payload);
                report.updated++;
            } else {
                await store(ename, ACCOUNT_ONTOLOGY, account.payload);
                report.created++;
            }
        } catch (error) {
            console.error(`[SYNC] ${ename} account ${account.key}: ${(error as Error).message}`);
        }
    }
    const after = await list(ename, ACCOUNT_ONTOLOGY);
    report.stillUnsynced = accounts
        .filter((a) => classifyAccount(after, a).status !== "synced")
        .map((a) => a.key);
}

/** Point the live adapter's mapping at the copy that is really in the vault. */
const remember = (row: Ledger, ename: string, globalId: string) =>
    rememberId(`${row.id}::${ename}`, globalId);

async function rememberId(localId: string, globalId: string): Promise<void> {
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
        `[SYNC] eCurrency ledger + accounts → eVaults, ${APPLY ? "APPLY (writes enabled)" : "CHECK ONLY (no writes)"}`,
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

    // Parties per row, as the subscriber resolves them (plus holders of one-sided rows).
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
        // Mints, burns and "Account initialized" have no parties: the live sync
        // never wrote them anywhere, so they go to the holder's own vault.
        if (parties.size === 0) {
            const holder = enameOf.get(`${row.accountType}:${row.accountId}`);
            if (holder) parties.add(holder);
            else noParties++;
        }
        for (const ename of parties) {
            if (ONLY && ename !== ONLY) continue;
            byVault.set(ename, [...(byVault.get(ename) ?? []), row]);
        }
    }

    const currencyList = await AppDataSource.getRepository(Currency).find();
    const currencies = new Map(currencyList.map((c) => [c.id, c]));
    const currencyReport = await syncCurrencies(currencyList, enameOf);
    console.log(
        `[SYNC] ${currencyList.length} currencies: ${currencyReport.synced} synced, ${currencyReport.missing} missing` +
            (APPLY ? `, ${currencyReport.created} created` : ""),
    );

    // One Account per holder and currency. Its balance is the sum of the
    // chain, which wins over any row's stored balance should they disagree.
    // Every row counts here, including ones with no parties ("Account initialized").
    const accountsByVault = new Map<string, Map<string, ExpectedAccount>>();
    for (const row of rows) {
        const ename = enameOf.get(`${row.accountType}:${row.accountId}`);
        const currency = currencies.get(row.currencyId);
        if (!ename || !currency?.ename) continue;
        if (ONLY && ename !== ONLY) continue;
        const accounts = accountsByVault.get(ename) ?? new Map<string, ExpectedAccount>();
        accountsByVault.set(ename, accounts);
        const key = `${row.accountType}:${row.accountId}|${normalizeEname(currency.ename)}`;
        const existing = accounts.get(key);
        const balance = Math.round(((existing?.payload.balance ?? 0) + Number(row.amount)) * 100) / 100;
        accounts.set(key, {
            key,
            payload: {
                accountId: row.accountId,
                accountEname: ename,
                accountType: row.accountType,
                currencyEname: normalizeEname(currency.ename),
                currencyName: currency.name,
                balance,
                createdAt: existing?.payload.createdAt ?? row.createdAt.toISOString(),
            },
        });
    }
    const accountCount = [...accountsByVault.values()].reduce((s, m) => s + m.size, 0);
    const vaultNames = new Set([...byVault.keys(), ...accountsByVault.keys()]);

    console.log(
        `[SYNC] ${rows.length} ledger rows, ${accountCount} accounts, ${vaultNames.size} eVaults to check` +
            (noParties ? `, ${noParties} rows with no parties and a holder with no eName (cannot be synced)` : "") +
            (unnamed.size ? `, ${unnamed.size} accounts with no eName (cannot be synced)` : ""),
    );

    const vaults = [...vaultNames].map((ename): [string, Ledger[], ExpectedAccount[]] => [
        ename,
        byVault.get(ename) ?? [],
        [...(accountsByVault.get(ename)?.values() ?? [])],
    ]);
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
                const [ename, vaultRows, vaultAccounts] = vaults[next++];
                inFlight.add(ename);
                const r = await syncVault(ename, vaultRows, vaultAccounts);
                inFlight.delete(ename);
                reports.push(r);
                if (r.skipped) {
                    console.log(
                        `[SYNC] ${ename}: ${r.expected} rows, ${r.accounts.expected} accounts · SKIPPED, ${r.skipped}`,
                    );
                    continue;
                }
                const a = r.accounts;
                const verdict = r.error
                    ? `ERROR ${r.error}`
                    : r.stillUnsynced.length || a.stillUnsynced.length
                      ? `✗ ${r.stillUnsynced.length} rows, ${a.stillUnsynced.length} accounts unsynced`
                      : "✓ verified";
                console.log(
                    `[SYNC] ${ename}: ${r.expected} rows · ${r.synced} synced · ${r.missing} missing · ${r.outdated} outdated` +
                        (r.duplicates ? ` · ${r.duplicates} duplicate copies` : "") +
                        (APPLY ? ` → created ${r.created}, updated ${r.updated}` : "") +
                        ` | ${a.expected} accounts · ${a.synced} synced · ${a.missing} missing · ${a.outdated} stale` +
                        (APPLY ? ` → created ${a.created}, updated ${a.updated}` : "") +
                        ` · ${verdict}`,
                );
            }
        }),
    );
    clearInterval(heartbeat);

    type Counter = "expected" | "synced" | "missing" | "outdated" | "duplicates" | "created" | "updated";
    const sum = (k: Counter) => checked.reduce((s, r) => s + r[k], 0);
    const sumAccounts = (k: Counter) => checked.reduce((s, r) => s + r.accounts[k], 0);
    const skipped = reports.filter((r) => r.skipped);
    const checked = reports.filter((r) => !r.skipped);
    const failed = checked.filter(
        (r) => r.error || r.stillUnsynced.length || r.accounts.stillUnsynced.length,
    );
    console.log("[SYNC] ==========================================");
    console.log(`[SYNC] Currencies           : ${currencyReport.synced} synced, ${currencyReport.missing} missing` +
        (APPLY ? `, ${currencyReport.created} created` : ""));
    for (const line of currencyReport.failed) console.log(`[SYNC]   ✗ ${line}`);
    for (const line of currencyReport.elsewhere) console.log(`[SYNC]   ? ${line}`);
    console.log(`[SYNC] Row copies expected  : ${sum("expected")}`);
    console.log(`[SYNC] Already synced       : ${sum("synced")}`);
    console.log(`[SYNC] Missing              : ${sum("missing")}`);
    console.log(`[SYNC] Outdated             : ${sum("outdated")} (no hash, or the wrong currency id)`);
    console.log(`[SYNC] Duplicate copies     : ${sum("duplicates")} (reported, never deleted)`);
    if (APPLY) {
        console.log(`[SYNC] Created              : ${sum("created")}`);
        console.log(`[SYNC] Updated in place     : ${sum("updated")}`);
    }
    console.log(`[SYNC] Accounts expected    : ${sumAccounts("expected")}`);
    console.log(`[SYNC]   Already synced     : ${sumAccounts("synced")}`);
    console.log(`[SYNC]   Missing            : ${sumAccounts("missing")}`);
    console.log(`[SYNC]   Stale              : ${sumAccounts("outdated")} (wrong balance or details)`);
    console.log(`[SYNC]   Duplicate copies   : ${sumAccounts("duplicates")} (reported, never deleted)`);
    if (APPLY) {
        console.log(`[SYNC]   Created            : ${sumAccounts("created")}`);
        console.log(`[SYNC]   Updated in place   : ${sumAccounts("updated")}`);
    }
    console.log(
        `[SYNC] Vaults fully in sync : ${checked.length - failed.length}/${checked.length}` +
            (APPLY ? " (re-read from each eVault after writing)" : ""),
    );
    for (const r of failed) {
        console.log(
            `[SYNC]   ${r.ename}: ${r.error ?? [
                r.stillUnsynced.length &&
                    `${r.stillUnsynced.length} rows unsynced: ${r.stillUnsynced.slice(0, 5).join(", ")}${r.stillUnsynced.length > 5 ? ", …" : ""}`,
                r.accounts.stillUnsynced.length &&
                    `${r.accounts.stillUnsynced.length} accounts unsynced: ${r.accounts.stillUnsynced.slice(0, 5).join(", ")}`,
            ]
                .filter(Boolean)
                .join("; ")}`,
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
    return failed.length === 0 && currencyReport.failed.length === 0;
}

main()
    .then((ok) => process.exit(ok ? 0 : 1))
    .catch((error) => {
        console.error("[SYNC] Fatal:", error);
        process.exit(1);
    });
