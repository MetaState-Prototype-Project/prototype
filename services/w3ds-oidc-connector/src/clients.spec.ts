import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { ClientRegistry, parseClients } from "./clients.js";

const hash = (secret: string) =>
    `sha256:${createHash("sha256").update(secret).digest("hex")}`;

const entry = (overrides: Record<string, unknown> = {}) => ({
    client_id: "keycloak",
    client_secret_hash: hash("s3cret"),
    redirect_uris: ["https://kc.example/realms/main/broker/w3ds/endpoint"],
    ...overrides,
});

const basic = (id: string, secret: string) =>
    `Basic ${Buffer.from(
        `${encodeURIComponent(id)}:${encodeURIComponent(secret)}`,
    ).toString("base64")}`;

describe("parseClients", () => {
    it("parses a valid client list", () => {
        const [client] = parseClients(
            JSON.stringify([entry({ synthetic_email: true, name: "KC" })]),
        );
        expect(client).toEqual({
            clientId: "keycloak",
            secretHash: hash("s3cret"),
            redirectUris: [
                "https://kc.example/realms/main/broker/w3ds/endpoint",
            ],
            syntheticEmail: true,
            name: "KC",
        });
    });

    it("defaults synthetic_email to false", () => {
        expect(parseClients(JSON.stringify([entry()]))[0].syntheticEmail).toBe(
            false,
        );
    });

    it("allows http only on loopback", () => {
        expect(() =>
            parseClients(
                JSON.stringify([
                    entry({ redirect_uris: ["http://localhost:8080/cb"] }),
                ]),
            ),
        ).not.toThrow();
        expect(() =>
            parseClients(
                JSON.stringify([
                    entry({ redirect_uris: ["http://kc.example/cb"] }),
                ]),
            ),
        ).toThrow(/https/);
    });

    it.each([
        ["not JSON", "{"],
        ["an empty list", "[]"],
        ["a missing client_id", JSON.stringify([entry({ client_id: "" })])],
        ["duplicate ids", JSON.stringify([entry(), entry()])],
        [
            "a plaintext secret",
            JSON.stringify([entry({ client_secret_hash: "s3cret" })]),
        ],
        ["no redirect URIs", JSON.stringify([entry({ redirect_uris: [] })])],
        [
            "a redirect URI with a fragment",
            JSON.stringify([
                entry({ redirect_uris: ["https://kc.example/cb#x"] }),
            ]),
        ],
        [
            "a non-boolean synthetic_email",
            JSON.stringify([entry({ synthetic_email: "yes" })]),
        ],
    ])("rejects %s", (_label, json) => {
        expect(() => parseClients(json)).toThrow();
    });
});

describe("ClientRegistry.authenticate", () => {
    const registry = new ClientRegistry(
        parseClients(
            JSON.stringify([
                entry(),
                entry({
                    client_id: "odd:id",
                    client_secret_hash: hash("p@ss:w rd"),
                }),
            ]),
        ),
    );

    it("accepts client_secret_basic", async () => {
        const result = await registry.authenticate({
            authorization: basic("keycloak", "s3cret"),
        });
        expect(result).toMatchObject({
            ok: true,
            client: { clientId: "keycloak" },
        });
    });

    it("URL-decodes basic credentials", async () => {
        const result = await registry.authenticate({
            authorization: basic("odd:id", "p@ss:w rd"),
        });
        expect(result).toMatchObject({ ok: true });
    });

    it("accepts client_secret_post", async () => {
        const result = await registry.authenticate({
            body: { client_id: "keycloak", client_secret: "s3cret" },
        });
        expect(result).toMatchObject({ ok: true });
    });

    it("rejects both methods at once", async () => {
        const result = await registry.authenticate({
            authorization: basic("keycloak", "s3cret"),
            body: { client_id: "keycloak", client_secret: "s3cret" },
        });
        expect(result).toEqual({ ok: false, error: "invalid_request" });
    });

    it.each([
        ["no credentials", {}],
        ["a wrong secret", { authorization: basic("keycloak", "nope") }],
        ["an unknown client", { authorization: basic("ghost", "s3cret") }],
        ["a malformed basic header", { authorization: "Basic !!!" }],
        ["a public client", { body: { client_id: "keycloak" } }],
    ])("rejects %s", async (_label, credentials) => {
        expect(await registry.authenticate(credentials)).toEqual({
            ok: false,
            error: "invalid_client",
        });
    });
});
