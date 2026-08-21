import { exportPKCS8, generateKeyPair } from "jose";
import { beforeAll, describe, expect, it } from "vitest";
import { KeyError, type Keyring, createKeyring } from "./keys.js";

const ISSUER = "https://w3ds-oidc.example.org";

let pem: string;
let otherPem: string;
let keyring: Keyring;

beforeAll(async () => {
    const pair = await generateKeyPair("ES256", { extractable: true });
    pem = await exportPKCS8(pair.privateKey);

    const other = await generateKeyPair("ES256", { extractable: true });
    otherPem = await exportPKCS8(other.privateKey);

    keyring = await createKeyring({
        signingKey: pem,
        keyId: "w3ds-oidc-1",
        issuer: ISSUER,
    });
});

describe("createKeyring", () => {
    it("rejects something that is not a key", async () => {
        await expect(
            createKeyring({
                signingKey: "not a key",
                keyId: "k",
                issuer: ISSUER,
            }),
        ).rejects.toBeInstanceOf(KeyError);
    });

    it("accepts a PEM whose newlines were escaped to survive a .env", async () => {
        const escaped = pem.replace(/\n/g, "\\n");
        const ring = await createKeyring({
            signingKey: escaped,
            keyId: "k",
            issuer: ISSUER,
        });
        expect(ring.jwks.keys).toHaveLength(1);
    });

    it("tolerates surrounding whitespace", async () => {
        const ring = await createKeyring({
            signingKey: `\n  ${pem}  \n`,
            keyId: "k",
            issuer: ISSUER,
        });
        expect(ring.jwks.keys).toHaveLength(1);
    });
});

describe("the JWKS document", () => {
    it("carries the configured key id and algorithm", () => {
        const key = keyring.jwks.keys[0];
        expect(key?.kid).toBe("w3ds-oidc-1");
        expect(key?.alg).toBe("ES256");
        expect(key?.use).toBe("sig");
    });

    it("publishes the public half only", () => {
        // `d` is the private scalar. Publishing it would hand out the identity of
        // every user of the bridge.
        const key = keyring.jwks.keys[0];
        expect(key?.d).toBeUndefined();
        expect(key?.kty).toBe("EC");
        expect(key?.crv).toBe("P-256");
        expect(key?.x).toBeDefined();
        expect(key?.y).toBeDefined();
    });
});

describe("sign and verify", () => {
    it("round-trips a payload", async () => {
        const token = await keyring.sign({ sub: "@alice", aud: "gitw3" }, 300);
        const payload = await keyring.verify(token, { audience: "gitw3" });
        expect(payload.sub).toBe("@alice");
    });

    it("sets iss byte-identically to the configured issuer", async () => {
        // goth compares this against the discovery document with no normalisation
        // whatsoever.
        const token = await keyring.sign({ sub: "@alice" }, 300);
        expect((await keyring.verify(token)).iss).toBe(ISSUER);
    });

    it("always sets a numeric exp", async () => {
        // Forgejo reads it as claims["exp"].(float64) with no guard, so a token
        // without one panics its handler rather than failing.
        const payload = await keyring.verify(
            await keyring.sign({ sub: "@alice" }, 300),
        );
        expect(typeof payload.exp).toBe("number");
        expect(payload.exp).toBeGreaterThan(payload.iat ?? 0);
    });

    it("names the key in the header so rotation stays possible", async () => {
        const token = await keyring.sign({ sub: "@alice" }, 300);
        const header = JSON.parse(
            Buffer.from(token.split(".")[0] ?? "", "base64url").toString(),
        );
        expect(header.kid).toBe("w3ds-oidc-1");
        expect(header.alg).toBe("ES256");
    });

    it("refuses a token signed by another key", async () => {
        const impostor = await createKeyring({
            signingKey: otherPem,
            keyId: "w3ds-oidc-1",
            issuer: ISSUER,
        });
        const token = await impostor.sign({ sub: "@mallory" }, 300);
        await expect(keyring.verify(token)).rejects.toThrow();
    });

    it("refuses a token whose payload was edited", async () => {
        const token = await keyring.sign({ sub: "@alice" }, 300);
        const [header, , signature] = token.split(".");
        const forged = Buffer.from(
            JSON.stringify({ sub: "@mallory", iss: ISSUER }),
        ).toString("base64url");
        await expect(
            keyring.verify(`${header}.${forged}.${signature}`),
        ).rejects.toThrow();
    });

    it("refuses an expired token", async () => {
        const token = await keyring.sign({ sub: "@alice" }, -60);
        await expect(keyring.verify(token)).rejects.toThrow();
    });

    it("refuses a token issued for another audience", async () => {
        const token = await keyring.sign(
            { sub: "@alice", aud: "someone-else" },
            300,
        );
        await expect(
            keyring.verify(token, { audience: "gitw3" }),
        ).rejects.toThrow();
    });

    it("refuses a token from another issuer", async () => {
        const elsewhere = await createKeyring({
            signingKey: pem,
            keyId: "w3ds-oidc-1",
            issuer: "https://elsewhere.example.org",
        });
        await expect(
            keyring.verify(await elsewhere.sign({ sub: "@alice" }, 300)),
        ).rejects.toThrow();
    });
});
