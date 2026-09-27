import { createHash } from "node:crypto";
import { type AppDeps, createApp, createDeps } from "./app.js";
import { type Config, loadConfig } from "./config.js";
import { generateSigningJwk, loadSigningKeys } from "./keys.js";

export const ISSUER = "http://localhost:4200";
export const REGISTRY = "http://registry.test";
export const KEYCLOAK_REDIRECT =
    "https://kc.example/realms/main/broker/w3ds/endpoint";
export const RAUTHY_REDIRECT = "https://rauthy.example/auth/v1/providers/callback";
export const SECRET = "s3cret";

const sha256Hash = (secret: string) =>
    `sha256:${createHash("sha256").update(secret).digest("hex")}`;

export function testConfig(overrides: Partial<Config> = {}): Config {
    return {
        ...loadConfig({
            W3DS_OIDC_ISSUER: ISSUER,
            PUBLIC_REGISTRY_URL: REGISTRY,
            W3DS_OIDC_PLATFORM_NAME: "Test Login",
            W3DS_OIDC_CLIENTS: JSON.stringify([
                {
                    client_id: "keycloak",
                    client_secret_hash: sha256Hash(SECRET),
                    redirect_uris: [KEYCLOAK_REDIRECT],
                    name: "Keycloak",
                },
                {
                    client_id: "rauthy",
                    client_secret_hash: sha256Hash(SECRET),
                    redirect_uris: [RAUTHY_REDIRECT],
                    synthetic_email: true,
                },
            ]),
        }),
        ...overrides,
    };
}

export async function testApp(overrides: Partial<AppDeps> = {}) {
    const config = overrides.config ?? testConfig();
    const keys = await loadSigningKeys({
        jwk: JSON.stringify(await generateSigningJwk()),
        production: false,
    });
    const deps = createDeps(config, keys, overrides);
    return { deps, app: createApp(deps) };
}
