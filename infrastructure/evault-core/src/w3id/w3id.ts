import { W3ID as W3IDClass, W3IDBuilder, hash } from "w3id";
import { LogService } from "./log-service";
import { Driver } from "neo4j-driver";
import nacl from "tweetnacl";
import { createSigner } from "../utils/signer";
import { SecretsStore } from "../secrets/secrets-store";
import { uint8ArrayToHex } from "../utils/codec";

export class W3ID {
    private static instance: W3IDClass;
    private static secretsStore: SecretsStore;

    private constructor() { }

    static async get(options?: {
        id: string;
        driver: Driver;
        password?: string;
    }) {
        if (W3ID.instance) return W3ID.instance;
        if (!options)
            throw new Error(
                "No instance of W3ID exists yet, please create it by passing options"
            );

        // Initialize secrets store if not already done
        if (!W3ID.secretsStore) {
            if (!options.password) {
                throw new Error("Password is required for secrets store");
            }
            W3ID.secretsStore = new SecretsStore(
                process.env.SECRETS_STORE_PATH!,
                options.password
            );
        }

        const repository = new LogService(options.driver);
        const keyId = `w3id-${options.id}`;

        try {
            // Try to get existing seed
            const { seed, nextKeyHash } = await W3ID.secretsStore.getSeed(keyId);
            const keyPair = nacl.sign.keyPair.fromSeed(seed);
            W3ID.instance = await new W3IDBuilder()
                .withId(options.id)
                .withRepository(repository)
                .withGlobal(true)
                .withSigner(createSigner(keyPair))
                .withNextKeyHash(nextKeyHash)
                .build();
        } catch {
            // If no seed exists, create new one
            const keyPair = nacl.sign.keyPair();
            const nextKeyPair = nacl.sign.keyPair();
            const nextKeyHash = await hash(uint8ArrayToHex(nextKeyPair.publicKey));

            // Store the seed
            await W3ID.secretsStore.storeSeed(keyId, keyPair.secretKey, nextKeyHash);

            W3ID.instance = await new W3IDBuilder()
                .withId(options.id)
                .withRepository(repository)
                .withSigner(createSigner(keyPair))
                .withNextKeyHash(nextKeyHash)
                .build();
        }

        return W3ID.instance;
    }
}
