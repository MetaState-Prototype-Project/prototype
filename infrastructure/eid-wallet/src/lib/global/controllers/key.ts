import { KeyManagerFactory } from "$lib/crypto";
import type { KeyManager } from "$lib/crypto";
import type { Store } from "@tauri-apps/plugin-store";
import type { UserController } from "./user";

export type KeyServiceContext =
    | "onboarding"
    | "signing"
    | "verification"
    | "pre-verification";

type PersistedContext = {
    keyId: string;
    context: KeyServiceContext;
    managerType: "hardware" | "software";
    lastUsed: string;
};

const CONTEXTS_KEY = "keyService.contexts";
const READY_KEY = "keyService.ready";

export class KeyService {
    #store: Store;
    #managerCache = new Map<string, KeyManager>();
    #contexts = new Map<string, PersistedContext>();
    #ready = false;

    constructor(store: Store) {
        this.#store = store;
    }

    async initialize(): Promise<void> {
        const storedContexts =
            await this.#store.get<Record<string, PersistedContext>>(
                CONTEXTS_KEY,
            );
        if (storedContexts) {
            for (const [key, value] of Object.entries(storedContexts)) {
                this.#contexts.set(key, value);
            }
        }
        this.#ready = (await this.#store.get<boolean>(READY_KEY)) ?? false;
    }

    get isReady(): boolean {
        return this.#ready;
    }

    async setReady(value: boolean): Promise<void> {
        this.#ready = value;
        await this.#store.set(READY_KEY, value);
    }

    async reset(): Promise<void> {
        this.#managerCache.clear();
        this.#contexts.clear();
        await this.#store.delete(CONTEXTS_KEY);
        await this.#store.delete(READY_KEY);
        this.#ready = false;
    }

    async getManager(
        keyId: string,
        context: KeyServiceContext,
    ): Promise<KeyManager> {
        const cacheKey = this.#getCacheKey(keyId, context);
        if (this.#managerCache.has(cacheKey)) {
            const cachedManager = this.#managerCache.get(cacheKey);
            if (cachedManager) {
                await this.#touchContext(cacheKey, cachedManager);
                return cachedManager;
            }
            this.#managerCache.delete(cacheKey);
        }

        const isFake = await this.#store
        .get<boolean>("fake")
        .then((f) => {
            if (!f) {
                return undefined;
            }
            return f;
        })
        .catch((error) => {
            console.error("Failed to get fake:", error);
            return undefined;
        });
        const manager = await KeyManagerFactory.getKeyManagerForContext(
            keyId,
            context,
            isFake,
        );
        this.#managerCache.set(cacheKey, manager);
        await this.#persistContext(cacheKey, manager, keyId, context);
        return manager;
    }

    async ensureKey(
        keyId: string,
        context: KeyServiceContext,
    ): Promise<{ manager: KeyManager; created: boolean }> {
        const manager = await this.getManager(keyId, context);
        const exists = await manager.exists(keyId);
        let created = false;
        if (!exists) {
            await manager.generate(keyId);
            await this.#touchContext(
                this.#getCacheKey(keyId, context),
                manager,
            );
            created = true;
        }
        return { manager, created };
    }

    async getPublicKey(
        keyId: string,
        context: KeyServiceContext,
    ): Promise<string | undefined> {
        const manager = await this.getManager(keyId, context);
        const publicKey = await manager.getPublicKey(keyId);
        await this.#touchContext(this.#getCacheKey(keyId, context), manager);
        return publicKey;
    }

    async signPayload(
        keyId: string,
        context: KeyServiceContext,
        payload: string,
    ): Promise<string> {
        const manager = await this.getManager(keyId, context);
        const signature = await manager.signPayload(keyId, payload);
        await this.#touchContext(this.#getCacheKey(keyId, context), manager);
        return signature;
    }

    async verifySignature(
        keyId: string,
        context: KeyServiceContext,
        payload: string,
        signature: string,
    ): Promise<boolean> {
        const manager = await this.getManager(keyId, context);
        const result = await manager.verifySignature(keyId, payload, signature);
        await this.#touchContext(this.#getCacheKey(keyId, context), manager);
        return result;
    }

    async isHardwareAvailable(): Promise<boolean> {
        return KeyManagerFactory.isHardwareAvailable();
    }

    #getCacheKey(keyId: string, context: KeyServiceContext): string {
        return `${context}:${keyId}`;
    }

    async #persistContext(
        cacheKey: string,
        manager: KeyManager,
        keyId: string,
        context: KeyServiceContext,
    ): Promise<void> {
        const entry: PersistedContext = {
            keyId,
            context,
            managerType: manager.getType(),
            lastUsed: new Date().toISOString(),
        };
        this.#contexts.set(cacheKey, entry);
        await this.#store.set(CONTEXTS_KEY, Object.fromEntries(this.#contexts));
    }

    async #touchContext(cacheKey: string, manager?: KeyManager): Promise<void> {
        const current = this.#contexts.get(cacheKey);
        if (!current && manager) {
            const { keyId, context } = this.#parseCacheKey(cacheKey);
            await this.#persistContext(cacheKey, manager, keyId, context);
            return;
        }
        if (!current) {
            return;
        }
        current.lastUsed = new Date().toISOString();
        this.#contexts.set(cacheKey, current);
        await this.#store.set(CONTEXTS_KEY, Object.fromEntries(this.#contexts));
    }

    #parseCacheKey(cacheKey: string): {
        context: KeyServiceContext;
        keyId: string;
    } {
        const [context, ...rest] = cacheKey.split(":");
        return {
            context: context as KeyServiceContext,
            keyId: rest.join(":"),
        };
    }
}
