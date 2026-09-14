import path from "node:path";
import { config as loadEnv } from "dotenv";

loadEnv({ path: path.resolve(__dirname, "../../../../.env") });

function required(name: string): string {
    const value = process.env[name];
    if (!value) {
        throw new Error(`Missing required environment variable: ${name}`);
    }
    return value;
}

function timerInterval(name: string, fallback: number): number {
    const raw = process.env[name];
    if (raw === undefined || !/^\d+$/.test(raw)) return fallback;
    const value = Number(raw);
    return Number.isSafeInteger(value) && value <= 2_147_483_647
        ? value
        : fallback;
}

function positiveInteger(name: string, fallback: number): number {
    const value = Number(process.env[name]);
    return Number.isSafeInteger(value) && value > 0 ? value : fallback;
}

export const config = {
    /** Postgres connection string for the AaaS database. */
    databaseUrl: process.env.AWARENESS_DATABASE_URL ?? "",
    apiPort: Number.parseInt(process.env.AWARENESS_API_PORT ?? "4100", 10),
    /** Shared secret evault-core must present on POST /ingest. */
    ingestSecret: process.env.AWARENESS_INGEST_SECRET ?? "",
    /** Registry used both for catch-all seeding and W3DS signature checks. */
    registryUrl:
        process.env.PUBLIC_REGISTRY_URL ?? process.env.REGISTRY_URL ?? "",
    /** Comma-separated eNames allowed to act as portal admins. */
    adminEnames: (process.env.AAAS_ADMIN_ENAMES ?? "")
        .split(",")
        .map((e) => e.trim())
        .filter(Boolean),
    /** Secret used to sign portal session JWTs. */
    jwtSecret: process.env.AAAS_JWT_SECRET ?? "awareness-dev-secret",
    deliveryPollMs: Number.parseInt(
        process.env.AWARENESS_DELIVERY_POLL_MS ?? "2000",
        10,
    ),
    /** How often registry platforms are reconciled with catch-all subscriptions. */
    registrySyncMs: timerInterval("AWARENESS_REGISTRY_SYNC_MS", 60000),
    /** Public base URL of the AaaS API, used to build W3DS auth callbacks. */
    publicUrl: process.env.AWARENESS_PUBLIC_URL ?? "http://localhost:4100",
    dbCaCert: process.env.DB_CA_CERT,
    workerId:
        process.env.AAAS_WORKER_ID ??
        `${process.env.HOSTNAME ?? "local"}-${process.pid}`,
    deliveryLeaseMs: positiveInteger("AWARENESS_DELIVERY_LEASE_MS", 30_000),
    deliveryBatchTimeoutMs: positiveInteger(
        "AWARENESS_DELIVERY_BATCH_TIMEOUT_MS",
        25_000,
    ),
    deliveryRetryWindowMs: positiveInteger(
        "AWARENESS_DELIVERY_RETRY_WINDOW_MS",
        24 * 60 * 60 * 1000,
    ),
    workerHeartbeatMs: positiveInteger("AWARENESS_WORKER_HEARTBEAT_MS", 10_000),
    workerStaleMs: positiveInteger("AWARENESS_WORKER_STALE_MS", 30_000),
    dbStatementTimeoutMs: positiveInteger(
        "AWARENESS_DB_STATEMENT_TIMEOUT_MS",
        10_000,
    ),
    dbQueryTimeoutMs: positiveInteger("AWARENESS_DB_QUERY_TIMEOUT_MS", 12_000),
    dbLockTimeoutMs: positiveInteger("AWARENESS_DB_LOCK_TIMEOUT_MS", 5_000),
};

export { required };
