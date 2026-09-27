import { describe, expect, it } from "vitest";
import {
    ClientRegistry,
    generateClientId,
    generateClientSecret,
    hashClientSecret,
    redirectUriError,
    validateClientInput,
} from "./clients.js";
import { MemoryClientRepository } from "./clients.memory.js";

const basic = (id: string, secret: string) =>
    `Basic ${Buffer.from(
        `${encodeURIComponent(id)}:${encodeURIComponent(secret)}`,
    ).toString("base64")}`;

describe("generated credentials", () => {
    it("are unguessable and distinct", () => {
        expect(generateClientId()).toMatch(/^w3ds_[A-Za-z0-9_-]{22}$/);
        expect(generateClientSecret()).toMatch(/^[A-Za-z0-9_-]{43}$/);
        expect(generateClientId()).not.toBe(generateClientId());
        expect(generateClientSecret()).not.toBe(generateClientSecret());
    });

    it("hash as sha256", () => {
        expect(hashClientSecret("s")).toMatch(/^sha256:[0-9a-f]{64}$/);
    });
});

describe("redirectUriError", () => {
    it.each([
        "https://kc.example/realms/main/broker/w3ds/endpoint",
        "http://localhost:8080/cb",
        "http://127.0.0.1/cb",
    ])("accepts %s", (uri) => {
        expect(redirectUriError(uri)).toBeNull();
    });

    it.each([
        ["http://kc.example/cb", /https/],
        ["https://kc.example/cb#frag", /fragment/],
        ["not a url", /not a valid URL/],
        ["javascript:alert(1)", /https/],
    ])("rejects %s", (uri, message) => {
        expect(redirectUriError(uri)).toMatch(message);
    });
});

describe("validateClientInput", () => {
    it("trims, splits lines and de-duplicates redirect URIs", () => {
        expect(
            validateClientInput({
                name: "  My IdP ",
                redirectUris:
                    "https://a.example/cb\r\n\n https://b.example/cb \nhttps://a.example/cb",
                syntheticEmail: "on",
            }),
        ).toEqual({
            ok: true,
            value: {
                name: "My IdP",
                redirectUris: ["https://a.example/cb", "https://b.example/cb"],
                syntheticEmail: true,
            },
        });
    });

    it("treats a missing checkbox as false", () => {
        const result = validateClientInput({
            name: "x",
            redirectUris: "https://a.example/cb",
        });
        expect(result.ok && result.value.syntheticEmail).toBe(false);
    });

    it("reports every problem at once", () => {
        const result = validateClientInput({
            name: " ",
            redirectUris: "http://evil.example/cb\nhttps://ok.example/cb#x",
        });
        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.errors).toHaveLength(3);
    });

    it("limits the name and the number of redirect URIs", () => {
        const tooMany = Array.from(
            { length: 11 },
            (_, i) => `https://a.example/${i}`,
        ).join("\n");
        const result = validateClientInput({
            name: "n".repeat(65),
            redirectUris: tooMany,
        });
        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.errors.join(" ")).toMatch(/64 characters/);
        expect(result.errors.join(" ")).toMatch(/at most 10/);
    });

    it("requires a redirect URI", () => {
        expect(validateClientInput({ name: "x", redirectUris: "" }).ok).toBe(false);
    });
});

describe("ClientRegistry.authenticate", () => {
    async function registry() {
        const repository = new MemoryClientRepository();
        for (const [clientId, secret] of [
            ["keycloak", "s3cret"],
            ["odd:id", "p@ss:w rd"],
        ]) {
            await repository.create({
                clientId,
                secretHash: hashClientSecret(secret),
                name: clientId,
                ownerEName: "@alice",
                redirectUris: ["https://kc.example/cb"],
                syntheticEmail: false,
            });
        }
        return new ClientRegistry(repository);
    }

    it("accepts client_secret_basic", async () => {
        const result = await (await registry()).authenticate({
            authorization: basic("keycloak", "s3cret"),
        });
        expect(result).toMatchObject({ ok: true, client: { clientId: "keycloak" } });
    });

    it("URL-decodes basic credentials", async () => {
        const result = await (await registry()).authenticate({
            authorization: basic("odd:id", "p@ss:w rd"),
        });
        expect(result).toMatchObject({ ok: true });
    });

    it("accepts client_secret_post", async () => {
        const result = await (await registry()).authenticate({
            body: { client_id: "keycloak", client_secret: "s3cret" },
        });
        expect(result).toMatchObject({ ok: true });
    });

    it("rejects both methods at once", async () => {
        const result = await (await registry()).authenticate({
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
        expect(await (await registry()).authenticate(credentials)).toEqual({
            ok: false,
            error: "invalid_client",
        });
    });

    it("stops accepting a secret once it is rotated", async () => {
        const reg = await registry();
        await reg.repository.rotateSecret("@alice", "keycloak", hashClientSecret("new"));
        expect(
            await reg.authenticate({ authorization: basic("keycloak", "s3cret") }),
        ).toMatchObject({ ok: false });
        expect(
            await reg.authenticate({ authorization: basic("keycloak", "new") }),
        ).toMatchObject({ ok: true });
    });
});
