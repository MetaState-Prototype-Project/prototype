import { createHash } from "node:crypto";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadConfig } from "./config.js";

const clients = JSON.stringify([
    {
        client_id: "keycloak",
        client_secret_hash: `sha256:${createHash("sha256").update("s").digest("hex")}`,
        redirect_uris: ["https://kc.example/cb"],
    },
]);

const env = (overrides: Record<string, string | undefined> = {}) => ({
    W3DS_OIDC_ISSUER: "http://localhost:4200",
    PUBLIC_REGISTRY_URL: "http://localhost:4321",
    W3DS_OIDC_CLIENTS: clients,
    ...overrides,
});

describe("loadConfig", () => {
    it("applies defaults", () => {
        expect(loadConfig(env())).toMatchObject({
            port: 4200,
            issuer: "http://localhost:4200",
            platformName: "W3DS Login",
            sessionTtlSeconds: 300,
            codeTtlSeconds: 60,
            tokenTtlSeconds: 300,
            upstreamTimeoutMs: 5000,
            trustProxy: false,
            production: false,
        });
    });

    it("strips a trailing slash from the issuer", () => {
        expect(
            loadConfig(env({ W3DS_OIDC_ISSUER: "https://id.example/" }))
                .issuer,
        ).toBe("https://id.example");
    });

    it("rejects an issuer with a path", () => {
        expect(() =>
            loadConfig(env({ W3DS_OIDC_ISSUER: "https://id.example/oidc" })),
        ).toThrow(/origin/);
    });

    it("requires https in production", () => {
        expect(() => loadConfig(env({ NODE_ENV: "production" }))).toThrow(
            /https/,
        );
    });

    it("reads clients from a file", () => {
        const dir = mkdtempSync(path.join(tmpdir(), "w3ds-oidc-"));
        const file = path.join(dir, "clients.json");
        writeFileSync(file, clients);
        const config = loadConfig(
            env({ W3DS_OIDC_CLIENTS: undefined, W3DS_OIDC_CLIENTS_FILE: file }),
        );
        expect(config.clients[0].clientId).toBe("keycloak");
    });

    it("rejects both client sources at once", () => {
        expect(() =>
            loadConfig(env({ W3DS_OIDC_CLIENTS_FILE: "/tmp/clients.json" })),
        ).toThrow(/only one/);
    });

    it("rejects a non-numeric TTL", () => {
        expect(() =>
            loadConfig(env({ W3DS_OIDC_CODE_TTL_SECONDS: "soon" })),
        ).toThrow(/positive integer/);
    });

    it("parses trust proxy hop counts", () => {
        expect(loadConfig(env({ W3DS_OIDC_TRUST_PROXY: "1" })).trustProxy).toBe(
            1,
        );
    });
});
