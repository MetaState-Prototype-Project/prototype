import { StorageSpec } from "../../src/logs/storage/storage-spec.ts";
import { LogEvent, LogEvents, Signer } from "../../src/logs/log.types.ts";
import { IDLogManager } from "../../src/logs/log-manager";
import { generateUuid } from "../../src/utils/uuid";
import { describe, it, test } from "vitest";
import { hash } from "../../src/utils/hash";
import nacl from "tweetnacl";
import { uint8ArrayToHex, hexToUint8Array } from "../../src/utils/codec";

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

const publicKey = uint8ArrayToHex(keyPair.publicKey);
const signer: Signer = {
    pubKey: publicKey,
    sign: (str: string) => {
        const buffer = hexToUint8Array(str);
        const signature = nacl.sign(buffer, keyPair.secretKey);
        return uint8ArrayToHex(signature);
    },
};

describe("LogManager", async () => {
    test("Create Genesis Entry", async () => {
        const nextKeyHash = await hash("asdf");
        const logEvent = await logManager.createLogEvent({
            id: w3id,
            type: LogEvents.Genesis,
            nextPubKey: nextKeyHash,
            signer,
        });
        console.log(logEvent);
    });
});
