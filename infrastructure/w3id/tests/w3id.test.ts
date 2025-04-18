import { W3ID, W3IDBuilder } from "../src";
import { describe, test, expect } from "vitest";
import falso from "@ngneat/falso";
import nacl from "tweetnacl";
import { createSigner, verifierCallback } from "./utils/crypto";
import { InMemoryStorage } from "./utils/store";
import { IDLogManager } from "../src/logs/log-manager";
import { hash } from "../src/utils/hash";
import { uint8ArrayToHex } from "../src/utils/codec";
import { LogEvent } from "../src/logs/log.types";
import { getJWTHeader, getJWTPayload } from "../src/utils/jwt";
import { JWTHeader } from "../src/logs/log.types";

const keyPair = nacl.sign.keyPair();

describe("W3IDBuilder", () => {
    test("ID Generation: Create Basic ID", async () => {
        const id = await new W3IDBuilder().build();
        expect(id).toBeInstanceOf(W3ID);
        expect(id.logs).toBeUndefined();
    });

    test("ID Generation: Global ID begins with `@`", async () => {
        const id = await new W3IDBuilder().withGlobal(true).build();
        expect(id.id.startsWith("@")).toBe(true);
    });

    test("ID Generation: Local ID begins doesn't begin with `@`", async () => {
        const id = await new W3IDBuilder().build();
        expect(id.id.startsWith("@")).toBe(false);
    });

    test("ID Generation: UUID is Deterministic", async () => {
        const namespace = falso.randUuid();
        const entropy = falso.randText();

        const id1 = await new W3IDBuilder()
            .withEntropy(entropy)
            .withNamespace(namespace)
            .build();

        const id2 = await new W3IDBuilder()
            .withEntropy(entropy)
            .withNamespace(namespace)
            .build();
        expect(id1.id).toEqual(id2.id);
        expect(id1.logs).toBeUndefined();
    });

    test("ID Generation: Creates IDLogManager", async () => {
        const id = await new W3IDBuilder()
            .withRepository(InMemoryStorage.build())
            .withSigner(createSigner(keyPair))
            .withNextKeyHash(falso.randText())
            .build();
        expect(id.logs).toBeInstanceOf(IDLogManager);
        const genesisLog = (await id.logs?.repository.findMany({}))[0];
        expect(genesisLog).toBeDefined();
    });

    test("ID Mutation: Key Rotation Works", async () => {
        const nextKeyPair = nacl.sign.keyPair();
        const nextKeyHash = await hash(uint8ArrayToHex(nextKeyPair.publicKey));

        const id = await new W3IDBuilder()
            .withRepository(InMemoryStorage.build())
            .withSigner(createSigner(keyPair))
            .withNextKeyHash(nextKeyHash)
            .build();

        await id.logs?.createLogEvent({
            nextKeySigner: createSigner(nextKeyPair),
            nextKeyHashes: [falso.randText()],
        });

        const logs = await id.logs?.repository.findMany({});
        const result = await IDLogManager.validateLogChain(
            logs as LogEvent[],
            verifierCallback,
        );
        expect(result).toBe(true);
    });
});

describe("W3ID JWT Signing", () => {
    test("should sign JWT with W3ID's ID as kid", async () => {
        const id = await new W3IDBuilder()
            .withRepository(InMemoryStorage.build())
            .withSigner(createSigner(keyPair))
            .withNextKeyHash(falso.randText())
            .build();

        const payload = {
            sub: "test-subject",
            iat: Math.floor(Date.now() / 1000),
        };

        const signedJWT = await id.signJWT(payload);
        const header = getJWTHeader(signedJWT);
        const extractedPayload = getJWTPayload(signedJWT);

        expect(header.kid).toBe(`@${id.id}#0`);
        expect(header.alg).toBe("ed25519");
        expect(header.typ).toBe("JWT");
        expect(extractedPayload).toEqual(payload);
        console.log(signedJWT);
    });

    test("should throw error when signing without a signer", async () => {
        const id = await new W3IDBuilder().build();
        const payload = { sub: "test-subject" };

        await expect(id.signJWT(payload)).rejects.toThrow(
            "W3ID must have a signer to sign JWTs",
        );
    });

    test("should use custom header when provided", async () => {
        const id = await new W3IDBuilder()
            .withRepository(InMemoryStorage.build())
            .withSigner(createSigner(keyPair))
            .withNextKeyHash(falso.randText())
            .build();

        const payload = { sub: "test-subject" };
        const customHeader: JWTHeader = {
            alg: "ed25519",
            typ: "JWT",
            kid: "custom-key",
        };

        const signedJWT = await id.signJWT(payload, customHeader);
        const header = getJWTHeader(signedJWT);

        expect(header).toEqual(customHeader);
    });

    test("should include all payload fields in signed JWT", async () => {
        const id = await new W3IDBuilder()
            .withRepository(InMemoryStorage.build())
            .withSigner(createSigner(keyPair))
            .withNextKeyHash(falso.randText())
            .build();

        const payload = {
            sub: "test-subject",
            iat: Math.floor(Date.now() / 1000),
            exp: Math.floor(Date.now() / 1000) + 3600,
            custom: "value",
        };

        const signedJWT = await id.signJWT(payload);
        const extractedPayload = getJWTPayload(signedJWT);

        expect(extractedPayload).toEqual(payload);
    });
});
