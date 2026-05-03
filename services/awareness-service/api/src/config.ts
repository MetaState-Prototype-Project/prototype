import { config as loadEnv } from "dotenv";
import path from "path";

loadEnv({ path: path.resolve(__dirname, "../../../../.env") });

function required(name: string): string {
    const value = process.env[name];
    if (!value) {
        throw new Error(`Missing required environment variable: ${name}`);
    }
    return value;
}

export const config = {
    /** Postgres connection string for the AaaS database. */
    databaseUrl: process.env.AWARENESS_DATABASE_URL ?? "",
    apiPort: parseInt(process.env.AWARENESS_API_PORT ?? "4100", 10),
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
    maxAttempts: parseInt(process.env.AWARENESS_MAX_ATTEMPTS ?? "8", 10),
    deliveryPollMs: parseInt(
        process.env.AWARENESS_DELIVERY_POLL_MS ?? "2000",
        10,
    ),
    /** Public base URL of the AaaS API, used to build W3DS auth callbacks. */
    publicUrl: process.env.AWARENESS_PUBLIC_URL ?? "http://localhost:4100",
    dbCaCert: process.env.DB_CA_CERT,
};

export { required };
