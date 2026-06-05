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

/**
 * W3DS-native: no local database. Reads come from Awareness-as-a-Service,
 * writes go straight to the owner's eVault via GraphQL.
 */
export const env = {
    port: Number(process.env.PROFILE_EDITOR_API_PORT) || 3007,
    jwtSecret: required("PROFILE_EDITOR_JWT_SECRET"),

    registryUrl: required("PUBLIC_REGISTRY_URL"),
    baseUrl: required("PUBLIC_PROFILE_EDITOR_BASE_URL"),

    awarenessServiceUrl: optional(
        "AWARENESS_SERVICE_URL",
        "http://localhost:4100",
    ),
    // Bearer key (aaas_…) used to read /api/packets — required for all reads.
    awarenessApiKey: required("AWARENESS_API_KEY"),

    // File-manager stores uploaded blobs; profiles store the returned public
    // URL. The JWT secret MUST match the file-manager's FILE_MANAGER_JWT_SECRET.
    fileManagerBaseUrl: optional(
        "PUBLIC_FILE_MANAGER_BASE_URL",
        "https://file-manager.w3ds.metastate.foundation",
    ),
    fileManagerJwtSecret: process.env.FILE_MANAGER_JWT_SECRET,

    nodeEnv: optional("NODE_ENV", "development"),
} as const;
