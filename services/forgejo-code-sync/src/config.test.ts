import { describe, expect, it } from "vitest";
import { ConfigError, loadConfig } from "./config.js";

const complete: NodeJS.ProcessEnv = {
    FORGEJO_SYNC_PUBLIC_URL: "https://forgejo-sync.example.org",
    FORGEJO_WEBHOOK_SECRET: "secret",
    FORGEJO_API_URL: "https://git.example.org",
    FORGEJO_ADMIN_TOKEN: "token",
    PUBLIC_REGISTRY_URL: "https://registry.example.org",
    PUBLIC_EVAULT_SERVER_URI: "https://evault.example.org",
};

const env = (overrides: NodeJS.ProcessEnv = {}) => ({
    ...complete,
    ...overrides,
});

describe("loadConfig", () => {
    it("accepts a complete environment", () => {
        const config = loadConfig(env());
        expect(config.webhookSecret).toBe("secret");
        expect(config.port).toBe(4300);
        expect(config.diffMaxBytes).toBe(131072);
    });

    describe("required keys", () => {
        const keys = [
            "FORGEJO_SYNC_PUBLIC_URL",
            "FORGEJO_WEBHOOK_SECRET",
            "FORGEJO_API_URL",
            "FORGEJO_ADMIN_TOKEN",
            "PUBLIC_REGISTRY_URL",
            "PUBLIC_EVAULT_SERVER_URI",
        ];

        it.each(keys)("throws naming %s when it is missing", (key) => {
            const incomplete = env();
            delete incomplete[key];
            // Naming the key matters: this error is the whole diagnostic a
            // deployer gets, matching the bridge's own config.ts.
            expect(() => loadConfig(incomplete)).toThrowError(new RegExp(key));
        });

        it.each(keys)("treats %s set to whitespace as missing", (key) => {
            expect(() => loadConfig(env({ [key]: "   " }))).toThrowError(
                ConfigError,
            );
        });
    });

    describe("URL normalisation", () => {
        it("strips a trailing slash from FORGEJO_SYNC_PUBLIC_URL", () => {
            expect(
                loadConfig(
                    env({ FORGEJO_SYNC_PUBLIC_URL: "https://b.example.org/" }),
                ).publicUrl,
            ).toBe("https://b.example.org");
        });

        it("strips a trailing slash from FORGEJO_API_URL", () => {
            expect(
                loadConfig(env({ FORGEJO_API_URL: "https://git.example.org/" }))
                    .forgejoApiUrl,
            ).toBe("https://git.example.org");
        });

        it("strips a trailing slash from PUBLIC_EVAULT_SERVER_URI", () => {
            expect(
                loadConfig(
                    env({
                        PUBLIC_EVAULT_SERVER_URI: "https://evault.example.org/",
                    }),
                ).evaultServerUri,
            ).toBe("https://evault.example.org");
        });
    });

    describe("the port", () => {
        it("parses a value", () => {
            expect(loadConfig(env({ FORGEJO_SYNC_PORT: "5000" })).port).toBe(
                5000,
            );
        });

        it.each(["nope", "0", "70000", "4300.5"])("rejects %s", (value) => {
            expect(() =>
                loadConfig(env({ FORGEJO_SYNC_PORT: value })),
            ).toThrowError(ConfigError);
        });
    });

    describe("the diff cap", () => {
        it("parses a value", () => {
            expect(
                loadConfig(env({ FORGEJO_SYNC_DIFF_MAX_BYTES: "1000" }))
                    .diffMaxBytes,
            ).toBe(1000);
        });

        it("accepts 0 (never inline)", () => {
            expect(
                loadConfig(env({ FORGEJO_SYNC_DIFF_MAX_BYTES: "0" }))
                    .diffMaxBytes,
            ).toBe(0);
        });

        it.each(["nope", "-1", "1000.5"])("rejects %s", (value) => {
            expect(() =>
                loadConfig(env({ FORGEJO_SYNC_DIFF_MAX_BYTES: value })),
            ).toThrowError(ConfigError);
        });
    });
});
