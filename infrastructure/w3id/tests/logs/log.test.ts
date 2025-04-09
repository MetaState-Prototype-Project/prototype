import { StorageSpec } from "../../src/logs/storage/storage-spec.ts";
import { LogEvent, LogEvents, Signer } from "../../src/logs/log.types.ts";
import { IDLogManager } from "../../src/logs/log-manager";
import { generateUuid } from "../../src/utils/uuid";
import { describe, expect, test, expectTypeOf } from "vitest";
import { hash } from "../../src/utils/hash";
import nacl from "tweetnacl";
import { uint8ArrayToHex, stringToUint8Array } from "../../src/utils/codec";
import { base58btc } from "multiformats/bases/base58";

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

function createSigner(keyPair: nacl.SignKeyPair): Signer {
    const publicKey = uint8ArrayToHex(keyPair.publicKey);
    const signer: Signer = {
        pubKey: publicKey,
        sign: (str: string) => {
            const buffer = stringToUint8Array(str);
            const signature = nacl.sign(buffer, keyPair.secretKey);
            return base58btc.encode(signature);
        },
    };
    return signer;
}

describe("LogManager", async () => {
    test("GenesisEvent: [Creates Entry]", async () => {
        const nextKeyHash = await hash(uint8ArrayToHex(currNextKey.publicKey));
        const signer = createSigner(keyPair);
        const logEvent = await logManager.createLogEvent({
            id: w3id,
            type: LogEvents.Genesis,
            nextKeyHashes: [nextKeyHash],
            signer,
        });
        expectTypeOf(logEvent).toMatchObjectType<LogEvent>();
    });

    test("KeyRotation: [Error At Wrong Next Key]", async () => {
        const nextKeyPair = nacl.sign.keyPair();
        const nextKeyHash = await hash(uint8ArrayToHex(nextKeyPair.publicKey));

        const signer = createSigner(nextKeyPair);
        const nextKeySigner = createSigner(nextKeyPair);
        const logEvent = logManager.createLogEvent({
            type: LogEvents.Rotation,
            nextKeyHashes: [nextKeyHash],
            signer,
            nextKeySigner,
        });

        await expect(logEvent).rejects.toThrow();
    });

    test("KeyRotation: [Creates Entry]", async () => {
        const nextKeyPair = nacl.sign.keyPair();
        const nextKeyHash = await hash(uint8ArrayToHex(nextKeyPair.publicKey));

        const signer = createSigner(keyPair);
        const nextKeySigner = createSigner(currNextKey);
        const logEvent = await logManager.createLogEvent({
            type: LogEvents.Rotation,
            nextKeyHashes: [nextKeyHash],
            signer,
            nextKeySigner,
        });

        expectTypeOf(logEvent).toMatchObjectType<LogEvent>();
    });
});
