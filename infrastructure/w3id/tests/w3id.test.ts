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
