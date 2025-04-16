/**
 * According to the project specification there are supposed to be 2 main types of
 * W3ID's ones which are tied to more tangible entities and hence need rotation
 * and others which are just UUIDs. Hence the approach to do this in a builder pattern
 */

import { IDLogManager } from "./logs/log-manager";
import { LogEvent, Signer } from "./logs/log.types";
import { StorageSpec } from "./logs/storage/storage-spec";
import { generateRandomAlphaNum } from "./utils/rand";
import { v4 as uuidv4 } from "uuid";
import { generateUuid } from "./utils/uuid";

export class W3ID {
    constructor(
        public id: string,
        public logs?: IDLogManager,
    ) {}
}

export class W3IDBuilder {
    private signer?: Signer;
    private repository?: StorageSpec<LogEvent, LogEvent>;
    private entropy?: string;
    private namespace?: string;
    private nextKeyHash?: string;
    private global?: boolean = false;

    public withEntropy(str: string): W3IDBuilder {
        this.entropy = str;
        return this;
    }

    public withGlobal(isGlobal: boolean): W3IDBuilder {
        this.global = isGlobal;
        return this;
    }

    public withNamespace(uuid: string): W3IDBuilder {
        this.namespace = uuid;
        return this;
    }

    public withRepository(
        storage: StorageSpec<LogEvent, LogEvent>,
    ): W3IDBuilder {
        this.repository = storage;
        return this;
    }

    public withSigner(signer: Signer): W3IDBuilder {
        this.signer = signer;
        return this;
    }

    public withNextKeyHash(hash: string): W3IDBuilder {
        this.nextKeyHash = hash;
        return this;
    }

    public async build(): Promise<W3ID> {
        this.entropy = this.entropy ?? generateRandomAlphaNum();
        this.namespace = this.namespace ?? uuidv4();
        const id = this.global
            ? "@"
            : "" + generateUuid(this.entropy, this.namespace);
        if (!this.signer) {
            return new W3ID(id);
        } else {
            if (!this.repository)
                throw new Error(
                    "Repository is required, pass with \`withRepository\` method",
                );

            if (!this.nextKeyHash)
                throw new Error(
                    "NextKeyHash is required pass with \`withNextKeyHash\` method",
                );
            const logs = new IDLogManager(this.repository, this.signer);
            await logs.createLogEvent({
                id,
                nextKeyHashes: [this.nextKeyHash],
            });
            return new W3ID(id, logs);
        }
    }
}
