import { describe, expect, it } from "vitest";
import { loadConfig } from "./config.js";

const env = (overrides: Record<string, string | undefined> = {}) => ({
    W3DS_OIDC_ISSUER: "http://localhost:4200",
    PUBLIC_REGISTRY_URL: "http://localhost:4321",
    W3DS_OIDC_DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/w3ds_oidc",
    ...overrides,
});

describe("loadConfig", () => {
    it("applies defaults", () => {
        expect(loadConfig(env())).toMatchObject({
            port: 4200,
            issuer: "http://localhost:4200",
            platformName: "W3DS Login",
            databaseUrl: "postgresql://postgres:postgres@localhost:5432/w3ds_oidc",
            sessionTtlSeconds: 300,
            codeTtlSeconds: 60,
            tokenTtlSeconds: 300,
            upstreamTimeoutMs: 5000,
            trustProxy: false,
            production: false,
        });
    });

    it("requires a database", () => {
        expect(() => loadConfig(env({ W3DS_OIDC_DATABASE_URL: undefined }))).toThrow(
            /W3DS_OIDC_DATABASE_URL/,
        );
    });

    it("strips a trailing slash from the issuer", () => {
        expect(
            loadConfig(env({ W3DS_OIDC_ISSUER: "https://oidc.w3ds.metastate.foundation/" }))
                .issuer,
        ).toBe("https://oidc.w3ds.metastate.foundation");
    });

    it("rejects an issuer with a path", () => {
        expect(() =>
            loadConfig(env({ W3DS_OIDC_ISSUER: "https://id.example/oidc" })),
        ).toThrow(/origin/);
    });

    it("requires https in production", () => {
        expect(() =>
            loadConfig(
                env({ NODE_ENV: "production", W3DS_OIDC_PORTAL_SECRET: "p".repeat(32) }),
            ),
        ).toThrow(/https/);
    });

    it("requires a portal secret in production", () => {
        expect(() =>
            loadConfig(
                env({
                    NODE_ENV: "production",
                    W3DS_OIDC_ISSUER: "https://oidc.w3ds.metastate.foundation",
                }),
            ),
        ).toThrow(/W3DS_OIDC_PORTAL_SECRET/);
    });

    it("rejects a short portal secret", () => {
        expect(() => loadConfig(env({ W3DS_OIDC_PORTAL_SECRET: "short" }))).toThrow(
            /at least 32/,
        );
    });

    it("defaults the client creation limit", () => {
        expect(loadConfig(env()).clientCreateLimit).toBe(10);
        expect(
            loadConfig(env({ W3DS_OIDC_CLIENT_CREATE_LIMIT: "3" })).clientCreateLimit,
        ).toBe(3);
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
