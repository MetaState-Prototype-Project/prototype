import { StorageSpec } from "../../src/logs/storage/storage-spec.ts";
import {
    LogEvent,
    Signer,
    VerifierCallback,
} from "../../src/logs/log.types.ts";
import { IDLogManager } from "../../src/logs/log-manager";
import { generateUuid } from "../../src/utils/uuid";
import { describe, expect, test, expectTypeOf } from "vitest";
import { hash } from "../../src/utils/hash";
import nacl from "tweetnacl";
import {
    uint8ArrayToHex,
    stringToUint8Array,
    hexToUint8Array,
} from "../../src/utils/codec";
import { base58btc } from "multiformats/bases/base58";
import falso from "@ngneat/falso";
import {
    BadNextKeySpecifiedError,
    BadOptionsSpecifiedError,
    BadSignatureError,
    MalformedHashChainError,
    MalformedIndexChainError,
} from "../../src/errors/errors.ts";

class InMemoryStorage<T extends LogEvent, K extends LogEvent>
    implements StorageSpec<T, K>
{
    private data: K[] = [];

    public static build<T extends LogEvent, K extends LogEvent>(): StorageSpec<
        T,
        K
    > {
        return new InMemoryStorage<T, K>();
    }

    public async create(body: T): Promise<K> {
        const entry = body as unknown as K;
        this.data.push(entry);
        return entry;
    }

    public async findOne(options: Partial<K>): Promise<K> {
        const result = this.data.find((item) =>
            Object.entries(options).every(
                ([key, value]) => item[key as keyof K] === value,
            ),
        );

        if (!result) throw new Error("Not found");
        return result;
    }

    public async findMany(options: Partial<K>): Promise<K[]> {
        return this.data.filter((item) =>
            Object.entries(options).every(
                ([key, value]) => item[key as keyof K] === value,
            ),
        );
    }
}
const logManager = new IDLogManager(InMemoryStorage.build());
const w3id = `@${generateUuid("asdfa")}`;

const keyPair = nacl.sign.keyPair();
let currNextKey = nacl.sign.keyPair();

const verifierCallback: VerifierCallback = async (
    message: string,
    signature: string,
    pubKey: string,
) => {
    const signatureBuffer = base58btc.decode(signature);
    const messageBuffer = stringToUint8Array(message);
    const publicKey = hexToUint8Array(pubKey);
    const isValid = nacl.sign.detached.verify(
        messageBuffer,
        signatureBuffer,
        publicKey,
    );

    return isValid;
};

function createSigner(keyPair: nacl.SignKeyPair): Signer {
    const publicKey = uint8ArrayToHex(keyPair.publicKey);
    const signer: Signer = {
        pubKey: publicKey,
        sign: (str: string) => {
            const buffer = stringToUint8Array(str);
            const signature = nacl.sign.detached(buffer, keyPair.secretKey);
            return base58btc.encode(signature);
        },
    };
    return signer;
}

describe("LogManager", async () => {
    test("GenesisEvent: [Throw at Bad Options]", async () => {
        const nextKeyHash = await hash(uint8ArrayToHex(currNextKey.publicKey));
        const signer = createSigner(keyPair);
        const logEvent = logManager.createLogEvent({
            nextKeySigner: signer,
            nextKeyHashes: [nextKeyHash],
            signer,
        });
        await expect(logEvent).rejects.toThrow(BadOptionsSpecifiedError);
    });

    test("GenesisEvent: [Creates Entry]", async () => {
        const nextKeyHash = await hash(uint8ArrayToHex(currNextKey.publicKey));
        const signer = createSigner(keyPair);
        const logEvent = await logManager.createLogEvent({
            id: w3id,
            nextKeyHashes: [nextKeyHash],
            signer,
        });
        expectTypeOf(logEvent).toMatchObjectType<LogEvent>();
    });

    test("KeyRotation: [Throw At Bad Options]", async () => {
        const nextKeyPair = nacl.sign.keyPair();
        const nextKeyHash = await hash(uint8ArrayToHex(nextKeyPair.publicKey));

        const signer = createSigner(nextKeyPair);
        const logEvent = logManager.createLogEvent({
            nextKeyHashes: [nextKeyHash],
            signer,
            id: `@{falso.randUuid()}`,
        });

        await expect(logEvent).rejects.toThrow(BadOptionsSpecifiedError);
    });

    test("KeyRotation: [Error At Wrong Next Key]", async () => {
        const nextKeyPair = nacl.sign.keyPair();
        const nextKeyHash = await hash(uint8ArrayToHex(nextKeyPair.publicKey));

        const signer = createSigner(nextKeyPair);
        const nextKeySigner = createSigner(nextKeyPair);
        const logEvent = logManager.createLogEvent({
            nextKeyHashes: [nextKeyHash],
            signer,
            nextKeySigner,
        });

        await expect(logEvent).rejects.toThrow(BadNextKeySpecifiedError);
    });

    test("KeyRotation: [Creates Entry]", async () => {
        const nextKeyPair = nacl.sign.keyPair();
        const nextKeyHash = await hash(uint8ArrayToHex(nextKeyPair.publicKey));

        const signer = createSigner(keyPair);
        const nextKeySigner = createSigner(currNextKey);
        const logEvent = await logManager.createLogEvent({
            nextKeyHashes: [nextKeyHash],
            signer,
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
