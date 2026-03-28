import "reflect-metadata";
import path from "node:path";
import { config } from "dotenv";

config({ path: path.resolve(__dirname, "../../../../.env") });

import axios from "axios";
import { AppDataSource } from "../database/data-source";
import { Ledger, AccountType } from "../database/entities/Ledger";
import { Currency } from "../database/entities/Currency";
import { User } from "../database/entities/User";
import { Group } from "../database/entities/Group";

// ─── Constants ────────────────────────────────────────────────────────────────

const ACCOUNT_ONTOLOGY = "6fda64db-fd14-4fa2-bd38-77d2e5e6136d";
const BATCH_SIZE = 10;
const DRY_RUN = process.argv.includes("--dry-run");
const REGISTRY_URL = "https://registry.w3ds.metastate.foundation";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function normalizeEname(value: string): string {
    return value.startsWith("@") ? value : `@${value}`;
}

let _platformToken: string | null = null;

async function getPlatformToken(forceRefresh = false): Promise<string> {
    if (_platformToken && !forceRefresh) return _platformToken;
    const response = await axios.post(
        `${REGISTRY_URL}/platforms/certification`,
        { platform: "ecurrency" },
        { timeout: 5_000 }
    );
    _platformToken = response.data.token as string;
    return _platformToken;
}

async function resolveEVaultUrl(eName: string): Promise<string> {
    const normalized = eName.startsWith("@") ? eName : `@${eName}`;
    const response = await axios.get(
        `${REGISTRY_URL}/resolve?w3id=${encodeURIComponent(normalized)}`,
        { timeout: 5_000 }
    );
    const url = response.data?.evaultUrl || response.data?.uri;
    if (!url) throw new Error(`Registry returned no eVault URL for ${normalized}`);
    return url as string;
}

// ─── eVault write ─────────────────────────────────────────────────────────────

interface BulkInput {
    ontology: string;
    payload: Record<string, unknown>;
    acl: string[];
}

const LEDGER_ONTOLOGY = "550e8400-e29b-41d4-a716-446655440006";

const FETCH_EXISTING_QUERY = `
    query FetchExisting($first: Int!, $after: String, $filter: MetaEnvelopeFilterInput) {
        metaEnvelopes(first: $first, after: $after, filter: $filter) {
            edges {
                node { id ontology parsed }
            }
            pageInfo { hasNextPage endCursor }
            totalCount
        }
    }
`;

async function fetchExistingEnvelopes(
    evaultUrl: string,
    vaultOwnerEname: string,
    token: string,
    ontology: string
): Promise<Array<{ id: string; parsed: any }>> {
    const graphqlUrl = new URL("/graphql", evaultUrl).toString();
    const all: Array<{ id: string; parsed: any }> = [];
    let cursor: string | null = null;
    let hasNextPage = true;

    while (hasNextPage) {
        const response: any = await axios.post(
            graphqlUrl,
            {
                query: FETCH_EXISTING_QUERY,
                variables: {
                    first: 100,
                    after: cursor,
                    filter: { ontologyId: ontology },
                },
            },
            {
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                    "X-ENAME": vaultOwnerEname,
                },
                timeout: 5_000,
            }
        );

        if (response.data.errors) {
            throw new Error(`GraphQL errors: ${JSON.stringify(response.data.errors)}`);
        }

        const data: any = response.data.data.metaEnvelopes;
        for (const edge of data.edges) {
            all.push({ id: edge.node.id, parsed: edge.node.parsed });
        }
        hasNextPage = data.pageInfo.hasNextPage;
        cursor = data.pageInfo.endCursor;
    }

    return all;
}

const BULK_CREATE_MUTATION = `
    mutation BulkCreate($inputs: [BulkMetaEnvelopeInput!]!) {
        bulkCreateMetaEnvelopes(inputs: $inputs, skipWebhooks: true) {
            successCount
            errorCount
            results { id success error }
        }
    }
`;

async function bulkCreateOnEVault(
    evaultUrl: string,
    vaultOwnerEname: string,
    token: string,
    inputs: BulkInput[]
): Promise<{ successCount: number; errorCount: number }> {
    const graphqlUrl = new URL("/graphql", evaultUrl).toString();
    let totalSuccess = 0;
    let totalErrors = 0;

    for (let i = 0; i < inputs.length; i += BATCH_SIZE) {
        const batch = inputs.slice(i, i + BATCH_SIZE);
        let response: any;

        try {
            response = await axios.post(
                graphqlUrl,
                { query: BULK_CREATE_MUTATION, variables: { inputs: batch } },
                {
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${token}`,
                        "X-ENAME": vaultOwnerEname,
                    },
                    timeout: 5_000,
                }
            );
        } catch (err: any) {
            if (err?.response?.status === 401) {
                const freshToken = await getPlatformToken(true);
                response = await axios.post(
                    graphqlUrl,
                    { query: BULK_CREATE_MUTATION, variables: { inputs: batch } },
                    {
                        headers: {
                            "Content-Type": "application/json",
                            Authorization: `Bearer ${freshToken}`,
                            "X-ENAME": vaultOwnerEname,
                        },
                        timeout: 5_000,
                    }
                );
            } else {
                throw err;
            }
        }

        if (response.data.errors) {
            throw new Error(`GraphQL errors: ${JSON.stringify(response.data.errors)}`);
        }

        const result = response.data.data.bulkCreateMetaEnvelopes;
        totalSuccess += result.successCount as number;
        totalErrors += result.errorCount as number;

        for (const r of result.results as Array<{ id: string; success: boolean; error?: string }>) {
            if (!r.success) {
                console.error(`[BACKFILL ERROR]   Envelope ${r.id}: ${r.error}`);
            }
        }
    }

    return { successCount: totalSuccess, errorCount: totalErrors };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
    console.log(`[BACKFILL] Starting eCurrency account backfill${DRY_RUN ? " (DRY RUN)" : ""}`);
    console.log(`[BACKFILL] Ontology: ${ACCOUNT_ONTOLOGY}`);

    await AppDataSource.initialize();

    const ledgerRepo = AppDataSource.getRepository(Ledger);
    const currencyRepo = AppDataSource.getRepository(Currency);
    const userRepo = AppDataSource.getRepository(User);
    const groupRepo = AppDataSource.getRepository(Group);

    const token = await getPlatformToken();
    console.log("[BACKFILL] Platform token acquired");

    // Find all distinct (accountId, accountType, currencyId) combos from ledger
    const distinctAccounts: Array<{
        accountId: string;
        accountType: AccountType;
        currencyId: string;
    }> = await ledgerRepo
        .createQueryBuilder("ledger")
        .select("ledger.accountId", "accountId")
        .addSelect("ledger.accountType", "accountType")
        .addSelect("ledger.currencyId", "currencyId")
        .distinct(true)
        .getRawMany();

    console.log(`[BACKFILL] Found ${distinctAccounts.length} unique accounts across all currencies`);

    // Cache currency lookups
    const currencyCache = new Map<string, Currency | null>();
    // Cache ename lookups
    const enameCache = new Map<string, string | null>();

    async function getCurrency(currencyId: string): Promise<Currency | null> {
        if (currencyCache.has(currencyId)) return currencyCache.get(currencyId)!;
        const currency = await currencyRepo.findOne({ where: { id: currencyId } });
        currencyCache.set(currencyId, currency);
        return currency;
    }

    async function getAccountEname(accountId: string, accountType: AccountType): Promise<string | null> {
        const key = `${accountType}:${accountId}`;
        if (enameCache.has(key)) return enameCache.get(key)!;

        let ename: string | null = null;
        if (accountType === AccountType.USER) {
            const user = await userRepo.findOne({ where: { id: accountId } });
            ename = user?.ename ? normalizeEname(user.ename) : null;
        } else {
            const group = await groupRepo.findOne({ where: { id: accountId } });
            ename = group?.ename ? normalizeEname(group.ename) : null;
        }

        enameCache.set(key, ename);
        return ename;
    }

    let totalBackfilled = 0;
    let totalSkipped = 0;
    let totalErrors = 0;

    // Group by account holder ename for batched eVault writes
    const vaultGroups = new Map<string, BulkInput[]>();

    for (let i = 0; i < distinctAccounts.length; i++) {
        const { accountId, accountType, currencyId } = distinctAccounts[i];

        const accountEname = await getAccountEname(accountId, accountType);
        if (!accountEname) {
            console.warn(`[BACKFILL WARNING] ${accountType} ${accountId} has no ename — skipping`);
            totalSkipped++;
            continue;
        }

        const currency = await getCurrency(currencyId);
        if (!currency) {
            console.warn(`[BACKFILL WARNING] Currency ${currencyId} not found — skipping`);
            totalSkipped++;
            continue;
        }

        const currencyEname = currency.ename ? normalizeEname(currency.ename) : null;
        if (!currencyEname) {
            console.warn(`[BACKFILL WARNING] Currency ${currencyId} has no ename — skipping`);
            totalSkipped++;
            continue;
        }

        // Get current balance from latest ledger entry
        const latestEntry = await ledgerRepo.findOne({
            where: { currencyId, accountId, accountType },
            order: { createdAt: "DESC" },
        });
        const balance = latestEntry ? Number(latestEntry.balance) : 0;

        // Get first entry for createdAt
        const firstEntry = await ledgerRepo.findOne({
            where: { currencyId, accountId, accountType },
            order: { createdAt: "ASC" },
        });

        const payload: Record<string, unknown> = {
            accountId,
            accountEname,
            accountType,
            currencyEname,
            currencyName: currency.name,
            balance,
            createdAt: firstEntry?.createdAt?.toISOString() ?? new Date().toISOString(),
        };

        if (!vaultGroups.has(accountEname)) {
            vaultGroups.set(accountEname, []);
        }
        vaultGroups.get(accountEname)!.push({
            ontology: ACCOUNT_ONTOLOGY,
            payload,
            acl: ["*"],
        });

        if ((i + 1) % 50 === 0) {
            console.log(`[BACKFILL] Processed ${i + 1}/${distinctAccounts.length} accounts`);
        }
    }

    console.log(`[BACKFILL] Built ${vaultGroups.size} vault groups, writing...`);

    // Write to eVaults
    for (const [vaultOwnerEname, inputs] of vaultGroups) {
        console.log(`[BACKFILL] Writing ${inputs.length} account(s) to vault ${vaultOwnerEname}...`);

        try {
            const evaultUrl = await resolveEVaultUrl(vaultOwnerEname);
            console.log(`[BACKFILL] Resolved ${vaultOwnerEname} → ${evaultUrl}`);

            // Pull existing ledger and account envelopes from this vault
            const existingLedgers = await fetchExistingEnvelopes(evaultUrl, vaultOwnerEname, token, LEDGER_ONTOLOGY);
            const existingAccounts = await fetchExistingEnvelopes(evaultUrl, vaultOwnerEname, token, ACCOUNT_ONTOLOGY);
            console.log(`[BACKFILL]   Existing on vault: ${existingLedgers.length} ledger(s), ${existingAccounts.length} account(s)`);

            if (existingLedgers.length > 0) {
                const currencyIds = new Set(existingLedgers.map((l: any) => l.parsed?.currencyId));
                console.log(`[BACKFILL]   Ledger currencies on vault: ${[...currencyIds].join(", ")}`);
            }
            if (existingAccounts.length > 0) {
                for (const acc of existingAccounts) {
                    console.log(`[BACKFILL]   Existing account: currency=${acc.parsed?.currencyEname}, balance=${acc.parsed?.balance}`);
                }
            }

            const filteredInputs: BulkInput[] = [];

            for (const input of inputs) {
                const alreadyExists = existingAccounts.some(
                    (a: any) => a.parsed?.accountId === input.payload.accountId && a.parsed?.currencyEname === input.payload.currencyEname
                );
                const ledgerCount = existingLedgers.filter(
                    (l: any) => l.parsed?.accountId === input.payload.accountId
                ).length;

                if (alreadyExists) {
                    console.log(`[BACKFILL]   SKIP (already exists) accountId=${input.payload.accountId} currency=${input.payload.currencyEname}`);
                    totalSkipped++;
                    continue;
                }

                console.log(
                    `[BACKFILL]   ${DRY_RUN ? "WOULD CREATE" : "CREATING"} accountId=${input.payload.accountId} currency=${input.payload.currencyEname} balance=${input.payload.balance} (${ledgerCount} ledger entries on vault)`
                );

                if (!DRY_RUN) {
                    filteredInputs.push(input);
                } else {
                    totalBackfilled++;
                }
            }

            if (!DRY_RUN) {
                if (filteredInputs.length > 0) {
                    const result = await bulkCreateOnEVault(evaultUrl, vaultOwnerEname, token, filteredInputs);
                    totalBackfilled += result.successCount;
                    totalErrors += result.errorCount;
                    console.log(
                        `[BACKFILL] Vault ${vaultOwnerEname}: +${result.successCount} created, ${result.errorCount} errors`
                    );
                }
            }
        } catch (error: any) {
            const msg = error instanceof Error ? error.message : String(error);
            const responseData = error?.response?.data ? JSON.stringify(error.response.data) : "no response body";
            console.error(`[BACKFILL ERROR] Vault ${vaultOwnerEname}: ${msg}`);
            console.error(`[BACKFILL ERROR] Response: ${responseData}`);
            totalErrors += inputs.length;
        }
    }

    console.log("[BACKFILL] ==========================================");
    console.log(`[BACKFILL] SUMMARY${DRY_RUN ? " (DRY RUN)" : ""}`);
    console.log(`[BACKFILL]   Total accounts found     : ${distinctAccounts.length}`);
    console.log(`[BACKFILL]   Successfully backfilled  : ${totalBackfilled}`);
    console.log(`[BACKFILL]   Skipped (no ename)       : ${totalSkipped}`);
    console.log(`[BACKFILL]   Errors (evault/graphql)  : ${totalErrors}`);
    console.log("[BACKFILL] ==========================================");

    await AppDataSource.destroy();
}

main()
    .then(() => { console.log("[BACKFILL] Done."); process.exit(0); })
    .catch((err) => { console.error("[BACKFILL] Fatal error:", err); process.exit(1); });
