import { describe, expect, it } from "vitest";
import { ConfigError, loadConfig } from "./config.js";

const complete: NodeJS.ProcessEnv = {
    W3DS_OIDC_PUBLIC_URL: "https://w3ds-oidc.example.org",
    W3DS_OIDC_CLIENT_ID: "gitw3",
    W3DS_OIDC_CLIENT_SECRET: "secret",
    W3DS_OIDC_REDIRECT_URI: "https://git.example.org/user/oauth2/W3DS/callback",
    W3DS_OIDC_SIGNING_KEY:
        "-----BEGIN PRIVATE KEY-----\nx\n-----END PRIVATE KEY-----",
    W3DS_OIDC_KEY_ID: "w3ds-oidc-1",
    PUBLIC_REGISTRY_URL: "https://registry.example.org",
};

const env = (overrides: NodeJS.ProcessEnv = {}) => ({
    ...complete,
    ...overrides,
});

describe("loadConfig", () => {
    it("accepts a complete environment", () => {
        const config = loadConfig(env());
        expect(config.clientId).toBe("gitw3");
        expect(config.port).toBe(4200);
        expect(config.emailDomain).toBe("w3ds.invalid");
        expect(config.minWalletVersion).toBe("0.4.0");
    });

    describe("required keys", () => {
        const keys = [
            "W3DS_OIDC_PUBLIC_URL",
            "W3DS_OIDC_CLIENT_ID",
            "W3DS_OIDC_CLIENT_SECRET",
            "W3DS_OIDC_REDIRECT_URI",
            "W3DS_OIDC_SIGNING_KEY",
            "W3DS_OIDC_KEY_ID",
            "PUBLIC_REGISTRY_URL",
        ];

        it.each(keys)("throws naming %s when it is missing", (key) => {
            const incomplete = env();
            delete incomplete[key];
            // Naming the key matters: this error is the whole diagnostic a
            // deployer gets.
            expect(() => loadConfig(incomplete)).toThrowError(new RegExp(key));
        });

        it.each(keys)("treats %s set to whitespace as missing", (key) => {
            expect(() => loadConfig(env({ [key]: "   " }))).toThrowError(
                ConfigError,
            );
        });
    });

    describe("the issuer", () => {
        it("strips a trailing slash", () => {
            // goth compares `iss` byte for byte. A stray slash fails every login
            // with no useful error, so it is normalised once, here.
            expect(
                loadConfig(
                    env({ W3DS_OIDC_PUBLIC_URL: "https://b.example.org/" }),
                ).publicUrl,
            ).toBe("https://b.example.org");
        });

        it("strips repeated trailing slashes", () => {
            expect(
                loadConfig(
                    env({ W3DS_OIDC_PUBLIC_URL: "https://b.example.org///" }),
                ).publicUrl,
            ).toBe("https://b.example.org");
        });

        it("keeps a path prefix intact", () => {
            expect(
                loadConfig(
                    env({
                        W3DS_OIDC_PUBLIC_URL: "https://b.example.org/oidc/",
                    }),
                ).publicUrl,
            ).toBe("https://b.example.org/oidc");
        });

        it("rejects a value that is not an absolute URL", () => {
            expect(() =>
                loadConfig(env({ W3DS_OIDC_PUBLIC_URL: "b.example.org" })),
            ).toThrowError(ConfigError);
        });
    });

    describe("the TLS guard", () => {
        it("refuses http:// by default", () => {
            expect(() =>
                loadConfig(
                    env({ W3DS_OIDC_PUBLIC_URL: "http://localhost:4200" }),
                ),
            ).toThrowError(/https/);
        });

        it("allows http:// only when the escape hatch is set explicitly", () => {
            const config = loadConfig(
                env({
                    W3DS_OIDC_PUBLIC_URL: "http://localhost:4200",
                    W3DS_OIDC_ALLOW_INSECURE: "true",
                }),
            );
            expect(config.publicUrl).toBe("http://localhost:4200");
        });

        it("does not treat a non-'true' value as consent", () => {
            // "1", "yes" and friends must not disable the guard by accident.
            for (const value of ["1", "yes", "TRUE", "on", ""]) {
                expect(() =>
                    loadConfig(
                        env({
                            W3DS_OIDC_PUBLIC_URL: "http://localhost:4200",
                            W3DS_OIDC_ALLOW_INSECURE: value,
                        }),
                    ),
                ).toThrowError(ConfigError);
            }
        });
    });

    describe("the port", () => {
        it("parses a value", () => {
            expect(loadConfig(env({ W3DS_OIDC_PORT: "5000" })).port).toBe(5000);
        });

        it.each(["nope", "0", "70000", "4200.5"])("rejects %s", (value) => {
            expect(() =>
                loadConfig(env({ W3DS_OIDC_PORT: value })),
            ).toThrowError(ConfigError);
        });
    });

    describe("extra reserved usernames", () => {
        it("defaults to empty", () => {
            expect(loadConfig(env()).extraReservedUsernames).toEqual([]);
        });

        it("splits, trims, lower-cases and drops blanks", () => {
            expect(
                loadConfig(
                    env({
                        W3DS_EXTRA_RESERVED_USERNAMES:
                            " Alice , ,bob ,, CHARLIE",
                    }),
                ).extraReservedUsernames,
            ).toEqual(["alice", "bob", "charlie"]);
        });
    });
});
