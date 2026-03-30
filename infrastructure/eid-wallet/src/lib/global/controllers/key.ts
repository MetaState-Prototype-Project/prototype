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

type HardwareFallbackEvent = {
    keyId: string;
    context: KeyServiceContext;
    originalError: unknown;
};

type EvaultKeyResolver = (
    keyId: string,
    context: string,
) => Promise<string[]>;
type EvaultSyncHandler = (
    keyId: string,
    context: string,
) => Promise<boolean>;

const CONTEXTS_KEY = "keyService.contexts";
const READY_KEY = "keyService.ready";

export class KeyService {
    #store: Store;
    #managerCache = new Map<string, KeyManager>();
    #contexts = new Map<string, PersistedContext>();
    #ready = false;
    #onHardwareFallback:
        | ((event: HardwareFallbackEvent) => Promise<void> | void)
        | null = null;
    #evaultKeyResolver: EvaultKeyResolver | null = null;
    #evaultSyncHandler: EvaultSyncHandler | null = null;
    #syncedKeyIds = new Set<string>();

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
        this.#syncedKeyIds.clear();
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
                // If user is pre-verification, ensure we're using software keys
                const isFake = await this.#isPreVerificationUser();
                if (isFake && cachedManager.getType() === "hardware") {
                    // Force software keys for pre-verification users
                    this.#managerCache.delete(cacheKey);
                } else {
                    return cachedManager;
                }
            }
            this.#managerCache.delete(cacheKey);
        }

        // Check persisted context — exact match first, then cross-context by keyId
        const exactPersisted = this.#contexts.get(cacheKey);
        const crossContext = exactPersisted
            ? undefined
            : this.#findPersistedByKeyId(keyId);
        const persistedEntry = exactPersisted ?? crossContext?.entry;
        const persistedMapKey = exactPersisted ? cacheKey : crossContext?.mapKey;

        if (persistedEntry && persistedMapKey) {
            const restoredManager = await KeyManagerFactory.getKeyManager({
                keyId,
                useHardware: persistedEntry.managerType === "hardware",
                preVerificationMode: false,
            });
            const keyExists = await restoredManager.exists(keyId);
            if (keyExists) {
                this.#managerCache.set(cacheKey, restoredManager);
                await this.#touchContext(cacheKey, restoredManager);
                return restoredManager;
            }
            // Key missing from storage — clear the actual stale persisted entry
            this.#contexts.delete(persistedMapKey);
            await this.#store.set(
                CONTEXTS_KEY,
                Object.fromEntries(this.#contexts),
            );
        }

        // Check eVault for which local key is actually registered (source of truth)
        const evaultMatch = await this.#resolveManagerByEvaultKey(keyId, context);
        if (evaultMatch) {
            this.#managerCache.set(cacheKey, evaultMatch);
            await this.#persistContext(cacheKey, evaultMatch, keyId, context);
            return evaultMatch;
        }

        // Last resort: factory logic (for fresh users with no persisted context and no eVault key yet)
        const isFake = await this.#isPreVerificationUser();
        const effectiveContext = isFake ? "pre-verification" : context;
        const manager = await KeyManagerFactory.getKeyManagerForContext(
            keyId,
            effectiveContext,
            isFake ?? false,
        );
        this.#managerCache.set(cacheKey, manager);
        await this.#persistContext(cacheKey, manager, keyId, context);
        return manager;
    }

    /**
     * Check if the current user is a pre-verification (demo) user
     */
    async #isPreVerificationUser(): Promise<boolean> {
        const isFake = await this.#store
            .get<boolean>("fake")
            .then((f) => {
                if (!f) {
                    return false;
                }
                return f;
            })
            .catch((error) => {
                console.error("Failed to get fake:", error);
                return false;
            });
        return isFake;
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
        console.log("=".repeat(70));
        console.log("🔐 [KeyService] signPayload called");
        console.log("=".repeat(70));
        console.log(`Key ID: ${keyId}`);
        console.log(`Context: ${context}`);
        console.log(`Payload: "${payload}"`);
        console.log(`Payload length: ${payload.length} bytes`);
        const payloadHex = Array.from(new TextEncoder().encode(payload))
            .map((b) => b.toString(16).padStart(2, "0"))
            .join("");
        console.log(`Payload (hex): ${payloadHex}`);

        const manager = await this.getManager(keyId, context);
        const managerType = manager.getType();
        console.log(`Manager type: ${managerType}`);

        // Get and log the public key that will be used for signing
        try {
            const publicKey = await manager.getPublicKey(keyId);
            if (publicKey) {
                console.log(`Public key: ${publicKey.substring(0, 60)}...`);
                console.log(`Public key (full): ${publicKey}`);
            } else {
                console.log("⚠️  Public key not available");
            }
        } catch (error) {
            console.log(
                `⚠️  Failed to get public key: ${error instanceof Error ? error.message : String(error)}`,
            );
        }

        // Ensure the key we're about to use is synced to the eVault before signing.
        // Only done once per session per keyId to avoid repeated network calls.
        await this.#ensureKeySyncedToEvault(keyId, context, manager);

        const cacheKey = this.#getCacheKey(keyId, context);
        try {
            console.log("=".repeat(70));
            const signature = await manager.signPayload(keyId, payload);
            console.log(
                `✅ [KeyService] Signature created: ${signature.substring(0, 50)}...`,
            );
            console.log(`Signature length: ${signature.length} chars`);
            console.log("=".repeat(70));

            await this.#touchContext(cacheKey, manager);
            return signature;
        } catch (signError) {
            console.warn(
                `[KeyService] Signing failed (${managerType}); attempting eVault key resolution`,
                {
                    keyId,
                    context,
                    error:
                        signError instanceof Error
                            ? signError.message
                            : String(signError),
                },
            );

            // Try eVault resolution: find whichever local key matches the registered one
            const syncCacheKey = `${keyId}:${context}`;
            this.#syncedKeyIds.delete(syncCacheKey);
            const evaultMatch = await this.#resolveManagerByEvaultKey(
                keyId,
                context,
            );
            if (evaultMatch && evaultMatch.getType() !== managerType) {
                console.log(
                    `[KeyService] eVault match found (${evaultMatch.getType()}), retrying sign`,
                );
                const retrySignature = await evaultMatch.signPayload(
                    keyId,
                    payload,
                );
                this.#managerCache.set(cacheKey, evaultMatch);
                await this.#persistContext(
                    cacheKey,
                    evaultMatch,
                    keyId,
                    context,
                );
                this.#syncedKeyIds.add(syncCacheKey);
                console.log(
                    `✅ [KeyService] eVault-resolved signature: ${retrySignature.substring(0, 50)}...`,
                );
                console.log("=".repeat(70));
                return retrySignature;
            }

            // If not hardware, no further fallback possible
            if (managerType !== "hardware") {
                throw signError;
            }

            // Hardware-specific fallback: try software key, generate if needed, then sync
            console.warn(
                "[KeyService] No eVault match; falling back to software key generation",
            );

            const softwareManager = await KeyManagerFactory.getKeyManager({
                keyId,
                useHardware: false,
                preVerificationMode: false,
            });

            const softwareKeyExists = await softwareManager.exists(keyId);
            if (!softwareKeyExists) {
                await softwareManager.generate(keyId);
            }

            const fallbackSignature = await softwareManager.signPayload(
                keyId,
                payload,
            );

            this.#managerCache.set(cacheKey, softwareManager);
            await this.#persistContext(
                cacheKey,
                softwareManager,
                keyId,
                context,
            );
            await this.#runHardwareFallbackCallback({
                keyId,
                context,
                originalError: signError,
            });

            console.log(
                `✅ [KeyService] Fallback signature created: ${fallbackSignature.substring(0, 50)}...`,
            );
            console.log("=".repeat(70));
            return fallbackSignature;
        }
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

    /**
     * Probe whether the device supports hardware-backed keys.
     * Bypasses the isFake / pre-verification gate — safe to call at any time,
     * including for anonymous users and during onboarding hardware checks.
     */
    async probeHardware(): Promise<boolean> {
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

    async clear() {
        this.#managerCache.clear();
        this.#contexts.clear();
        this.#syncedKeyIds.clear();
        await this.#store.delete(CONTEXTS_KEY);
        await this.#store.delete(READY_KEY);
        this.#ready = false;
    }

    setHardwareFallbackHandler(
        handler:
            | ((event: HardwareFallbackEvent) => Promise<void> | void)
            | null,
    ): void {
        this.#onHardwareFallback = handler;
    }

    setEvaultKeyResolver(resolver: EvaultKeyResolver | null): void {
        this.#evaultKeyResolver = resolver;
    }

    setEvaultSyncHandler(handler: EvaultSyncHandler | null): void {
        this.#evaultSyncHandler = handler;
    }

    async #runHardwareFallbackCallback(
        event: HardwareFallbackEvent,
    ): Promise<void> {
        if (!this.#onHardwareFallback) return;
        try {
            await this.#onHardwareFallback(event);
        } catch (callbackError) {
            console.error(
                "[KeyService] Hardware fallback callback failed:",
                callbackError,
            );
        }
    }

    /**
     * Ensure the key we're about to use is synced to the eVault.
     * Checks the eVault once per session per (keyId, context); if our public key
     * is not in the registered keys, triggers a sync before signing.
     * Only caches as synced when the handler confirms success.
     */
    async #ensureKeySyncedToEvault(
        keyId: string,
        context: KeyServiceContext,
        manager: KeyManager,
    ): Promise<void> {
        const syncCacheKey = `${keyId}:${context}`;
        if (this.#syncedKeyIds.has(syncCacheKey)) return;
        if (!this.#evaultKeyResolver || !this.#evaultSyncHandler) return;

        try {
            const publicKey = await manager.getPublicKey(keyId);
            if (!publicKey) return;

            const registeredKeys = await this.#evaultKeyResolver(keyId, context);
            if (registeredKeys.includes(publicKey)) {
                // Already synced — mark and skip future checks
                this.#syncedKeyIds.add(syncCacheKey);
                return;
            }

            // Our key is not registered — sync it before signing
            console.warn(
                `[KeyService] Key ${keyId} (${manager.getType()}) not found in eVault; syncing before sign`,
            );
            const synced = await this.#evaultSyncHandler(keyId, context);
            if (synced) {
                this.#syncedKeyIds.add(syncCacheKey);
            }
        } catch (error) {
            // Non-fatal: if sync check fails (offline, etc), proceed with signing
            console.warn(
                "[KeyService] Pre-sign eVault sync check failed:",
                error instanceof Error ? error.message : String(error),
            );
        }
    }

    /**
     * Find any persisted context entry for the given keyId, regardless of context.
     * This handles the case where a key was created with "onboarding" context
     * but is now being used with "signing" context.
     * Returns both the entry and its map key so the caller can delete the correct one.
     */
    #findPersistedByKeyId(
        keyId: string,
    ): { mapKey: string; entry: PersistedContext } | undefined {
        for (const [mapKey, entry] of this.#contexts.entries()) {
            if (entry.keyId === keyId) {
                return { mapKey, entry };
            }
        }
        return undefined;
    }

    /**
     * Query the eVault for registered public keys and find a local key manager
     * whose public key matches. The eVault is the source of truth — only a key
     * that is synced there can produce valid signatures.
     */
    async #resolveManagerByEvaultKey(
        keyId: string,
        context: KeyServiceContext = "signing",
    ): Promise<KeyManager | null> {
        if (!this.#evaultKeyResolver) return null;

        let registeredKeys: string[];
        try {
            registeredKeys = await this.#evaultKeyResolver(keyId, context);
        } catch {
            return null;
        }
        if (registeredKeys.length === 0) return null;

        // Check software key first (more likely to be the mismatched one)
        try {
            const softwareManager = await KeyManagerFactory.getKeyManager({
                keyId,
                useHardware: false,
                preVerificationMode: false,
            });
            if (await softwareManager.exists(keyId)) {
                const pubKey = await softwareManager.getPublicKey(keyId);
                if (pubKey && registeredKeys.includes(pubKey)) {
                    console.log(
                        "[KeyService] eVault key matches local software key",
                    );
                    return softwareManager;
                }
            }
        } catch {
            /* ignore */
        }

        // Check hardware key
        try {
            const hardwareAvailable =
                await KeyManagerFactory.isHardwareAvailable();
            if (hardwareAvailable) {
                const hardwareManager = await KeyManagerFactory.getKeyManager({
                    keyId,
                    useHardware: true,
                    preVerificationMode: false,
                });
                if (await hardwareManager.exists(keyId)) {
                    const pubKey = await hardwareManager.getPublicKey(keyId);
                    if (pubKey && registeredKeys.includes(pubKey)) {
                        console.log(
                            "[KeyService] eVault key matches local hardware key",
                        );
                        return hardwareManager;
                    }
                }
            }
        } catch {
            /* ignore */
        }

        return null;
    }
}
