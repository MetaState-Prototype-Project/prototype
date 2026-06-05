import path from "node:path";
import { config } from "dotenv";

// Load the repo-root .env (four levels up from src/ at runtime).
config({ path: path.resolve(__dirname, "../../../../.env") });

function required(name: string): string {
    const value = process.env[name];
    if (!value) throw new Error(`${name} is not configured`);
    return value;
}

function optional(name: string, fallback: string): string {
    return process.env[name] || fallback;
}

export const env = {
    port: Number(process.env.PROFILE_EDITOR_API_PORT) || 3007,
    jwtSecret: required("PROFILE_EDITOR_JWT_SECRET"),
    databaseUrl: required("PROFILE_EDITOR_DATABASE_URL"),
    dbCaCert: process.env.DB_CA_CERT,

    registryUrl: required("PUBLIC_REGISTRY_URL"),
    baseUrl: required("PUBLIC_PROFILE_EDITOR_BASE_URL"),
    mappingDbPath: required("PROFILE_EDITOR_MAPPING_DB_PATH"),

    awarenessServiceUrl: optional(
        "AWARENESS_SERVICE_URL",
        "http://localhost:4100",
    ),
    awarenessApiKey: process.env.AWARENESS_API_KEY,
    // Public URL AaaS should POST packets to. Set this to your tunnel
    // (e.g. https://xyz.trycloudflare.com/api/webhook) for local dev against
    // prod AaaS. Falls back to {baseUrl}/api/webhook.
    awarenessWebhookUrl: process.env.AWARENESS_WEBHOOK_URL,

    nodeEnv: optional("NODE_ENV", "development"),
} as const;
