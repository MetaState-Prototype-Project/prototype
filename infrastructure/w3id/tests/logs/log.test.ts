import { LogEvent } from "../../src/logs/log.types.ts";
import { IDLogManager } from "../../src/logs/log-manager";
import { generateUuid } from "../../src/utils/uuid";
import { describe, expect, test, expectTypeOf } from "vitest";
import { hash } from "../../src/utils/hash";
import nacl from "tweetnacl";
import { uint8ArrayToHex } from "../../src/utils/codec";
import falso from "@ngneat/falso";
import {
    BadNextKeySpecifiedError,
    BadOptionsSpecifiedError,
    BadSignatureError,
    MalformedHashChainError,
    MalformedIndexChainError,
} from "../../src/errors/errors.ts";
import { InMemoryStorage } from "../utils/store.ts";
import { createSigner, verifierCallback } from "../utils/crypto.ts";

const keyPair = nacl.sign.keyPair();
let currNextKey = nacl.sign.keyPair();

const signer = createSigner(keyPair);

const logManager = new IDLogManager(InMemoryStorage.build(), signer);
const w3id = `@${generateUuid("asdfa")}`;

describe("LogManager", async () => {
    test("GenesisEvent: [Throw at Bad Options]", async () => {
        const nextKeyHash = await hash(uint8ArrayToHex(currNextKey.publicKey));
        const signer = createSigner(keyPair);
        const logEvent = logManager.createLogEvent({
            nextKeySigner: signer,
            nextKeyHashes: [nextKeyHash],
        });
        await expect(logEvent).rejects.toThrow(BadOptionsSpecifiedError);
    });

    test("GenesisEvent: [Creates Entry]", async () => {
        const nextKeyHash = await hash(uint8ArrayToHex(currNextKey.publicKey));
        const logEvent = await logManager.createLogEvent({
            id: w3id,
            nextKeyHashes: [nextKeyHash],
        });
        expectTypeOf(logEvent).toMatchObjectType<LogEvent>();
    });

    test("KeyRotation: [Throw At Bad Options]", async () => {
        const nextKeyPair = nacl.sign.keyPair();
        const nextKeyHash = await hash(uint8ArrayToHex(nextKeyPair.publicKey));

        const logEvent = logManager.createLogEvent({
            nextKeyHashes: [nextKeyHash],
            id: `@{falso.randUuid()}`,
        });

        await expect(logEvent).rejects.toThrow(BadOptionsSpecifiedError);
    });

    test("KeyRotation: [Error At Wrong Next Key]", async () => {
        const nextKeyPair = nacl.sign.keyPair();
        const nextKeyHash = await hash(uint8ArrayToHex(nextKeyPair.publicKey));

        const nextKeySigner = createSigner(nextKeyPair);
        const logEvent = logManager.createLogEvent({
            nextKeyHashes: [nextKeyHash],
            nextKeySigner,
        });

        await expect(logEvent).rejects.toThrow(BadNextKeySpecifiedError);
    });

    test("KeyRotation: [Creates Entry]", async () => {
        const nextKeyPair = nacl.sign.keyPair();
        const nextKeyHash = await hash(uint8ArrayToHex(nextKeyPair.publicKey));

        const nextKeySigner = createSigner(currNextKey);
        const logEvent = await logManager.createLogEvent({
            nextKeyHashes: [nextKeyHash],
            nextKeySigner,
        });

        expectTypeOf(logEvent).toMatchObjectType<LogEvent>();
    });

    test("Verification: [Verifies Correct Chain]", async () => {
        const events = await logManager.repository.findMany({});
        const result = await IDLogManager.validateLogChain(
            events,
            verifierCallback,
        );
        expect(result).toBe(true);
    });

    test("Verification: [Throws on Malformed Index Chain]", async () => {
        const _events = await logManager.repository.findMany({});
        const events = JSON.parse(JSON.stringify(_events));
        events[1].versionId = `2-${falso.randUuid()}`;
        const result = IDLogManager.validateLogChain(events, verifierCallback);

        await expect(result).rejects.toThrow(MalformedIndexChainError);
    });

    test("Verification: [Throws on Malformed Hash Chain]", async () => {
        const _events = await logManager.repository.findMany({});
        const events = JSON.parse(JSON.stringify(_events));
        events[1].versionId = `1-${falso.randUuid()}`;
        const result = IDLogManager.validateLogChain(events, verifierCallback);

        await expect(result).rejects.toThrow(MalformedHashChainError);
    });

    test("Verification: [Throws on Wrong Signature]", async () => {
        const _events = await logManager.repository.findMany({});
        const events = JSON.parse(JSON.stringify(_events));
        const newKeyPair = nacl.sign.keyPair();
        const signer = createSigner(newKeyPair);

        delete events[1].proof;
        events[1].proof = await signer.sign(events[1]);
        const result = IDLogManager.validateLogChain(events, verifierCallback);

        await expect(result).rejects.toThrow(BadSignatureError);
    });
});
