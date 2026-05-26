import { KeyManagerFactory, migrateLegacySoftwareKey } from "$lib/crypto";
import type { KeyManager } from "$lib/crypto";
import type { Store } from "@tauri-apps/plugin-store";

type ManagerType = "hardware" | "software";
type EvaultKeyResolver = () => Promise<string[]>;
type EvaultSyncHandler = () => Promise<boolean>;

const MANAGER_TYPE_KEY = "keyService.managerType";
const READY_KEY = "keyService.ready";
const LEGACY_CONTEXTS_KEY = "keyService.contexts";

/**
 * Single-key service. Every wallet has exactly one key, hardware-backed when the
 * device supports it, software otherwise. Pre-verification (anonymous demo) users
 * are forced onto software so they don't pollute the hardware keystore.
 *
 * All key operations flow through #withEvaultSync, which on failure checks whether
 * the local key matches what the eVault has bound; if not, syncs and retries once.
 * A genuine failure after that is surfaced to the caller — no silent fallback.
 */
export class KeyService {
    #store: Store;
    #manager: KeyManager | null = null;
    #managerType: ManagerType | null = null;
    #ready = false;
    #evaultKeyResolver: EvaultKeyResolver | null = null;
    #evaultSyncHandler: EvaultSyncHandler | null = null;

    constructor(store: Store) {
        this.#store = store;
    }

    async initialize(): Promise<void> {
        await this.#migrateLegacyState();
        this.#managerType =
            (await this.#store.get<ManagerType>(MANAGER_TYPE_KEY)) ?? null;
        this.#ready = (await this.#store.get<boolean>(READY_KEY)) ?? false;
    }

    get isReady(): boolean {
        return this.#ready;
    }

    async setReady(value: boolean): Promise<void> {
        this.#ready = value;
        await this.#store.set(READY_KEY, value);
    }

    setEvaultKeyResolver(resolver: EvaultKeyResolver | null): void {
        this.#evaultKeyResolver = resolver;
    }

    setEvaultSyncHandler(handler: EvaultSyncHandler | null): void {
        this.#evaultSyncHandler = handler;
    }

    /**
     * Resolve the manager for this wallet. Picks hardware on capable devices,
     * software on incapable devices or for pre-verification users. The decision
     * is made once and persisted; subsequent calls return the cached manager.
     */
    async getManager(): Promise<KeyManager> {
        if (this.#manager) return this.#manager;

        if (this.#managerType) {
            this.#manager = KeyManagerFactory.get(this.#managerType);
            return this.#manager;
        }

        const forceSoftware = await this.#isPreVerificationUser();
        const type: ManagerType =
            !forceSoftware && (await KeyManagerFactory.isHardwareAvailable())
                ? "hardware"
                : "software";

        this.#manager = KeyManagerFactory.get(type);
        this.#managerType = type;
        await this.#store.set(MANAGER_TYPE_KEY, type);
        return this.#manager;
    }

    /**
     * Ensure the wallet key exists, generating it if needed. Returns true if a
     * new key was generated.
     */
    async ensureKey(): Promise<{ created: boolean }> {
        const manager = await this.getManager();
        if (await manager.exists()) return { created: false };
        await manager.generate();
        return { created: true };
    }

    async getPublicKey(): Promise<string> {
        const manager = await this.getManager();
        return manager.getPublicKey();
    }

    async sign(payload: string): Promise<string> {
        return this.#withEvaultSync(async () => {
            const manager = await this.getManager();
            return manager.signPayload(payload);
        });
    }

    async verify(payload: string, signature: string): Promise<boolean> {
        const manager = await this.getManager();
        return manager.verifySignature(payload, signature);
    }

    async probeHardware(): Promise<boolean> {
        return KeyManagerFactory.isHardwareAvailable();
    }

    async clear(): Promise<void> {
        this.#manager = null;
        this.#managerType = null;
        this.#ready = false;
        await this.#store.delete(MANAGER_TYPE_KEY);
        await this.#store.delete(READY_KEY);
        await this.#store.delete(LEGACY_CONTEXTS_KEY);
    }

    /**
     * Run a key operation. On failure, check whether our local public key is
     * bound on the eVault; if not, sync it and retry once. If the retry still
     * fails — or the local key was already bound — the original error stands.
     */
    async #withEvaultSync<T>(op: () => Promise<T>): Promise<T> {
        try {
            return await op();
        } catch (firstError) {
            if (!this.#evaultKeyResolver || !this.#evaultSyncHandler) {
                throw firstError;
            }

            let localPk: string;
            try {
                localPk = await this.getPublicKey();
            } catch {
                throw firstError;
            }

            let bound: string[];
            try {
                bound = await this.#evaultKeyResolver();
            } catch (resolverError) {
                console.warn(
                    "[KeyService] eVault key resolver failed during recovery:",
                    resolverError,
                );
                throw firstError;
            }

            if (bound.includes(localPk)) {
                // Our key is already bound — the failure is real.
                throw firstError;
            }

            console.warn(
                "[KeyService] Local key not bound on eVault; syncing and retrying",
            );
            const synced = await this.#evaultSyncHandler();
            if (!synced) {
                throw firstError;
            }
            return await op();
        }
    }

    async #isPreVerificationUser(): Promise<boolean> {
        try {
            return (await this.#store.get<boolean>("fake")) ?? false;
        } catch {
            return false;
        }
    }

    async #migrateLegacyState(): Promise<void> {
        migrateLegacySoftwareKey();
        try {
            const legacy =
                await this.#store.get<
                    Record<string, { managerType?: ManagerType }>
                >(LEGACY_CONTEXTS_KEY);
            if (!legacy) return;

            const existing =
                await this.#store.get<ManagerType>(MANAGER_TYPE_KEY);
            if (!existing) {
                const inferred = inferManagerTypeFromLegacy(legacy);
                if (inferred) {
                    await this.#store.set(MANAGER_TYPE_KEY, inferred);
                }
            }
            await this.#store.delete(LEGACY_CONTEXTS_KEY);
        } catch (error) {
            console.warn(
                "[KeyService] Legacy context migration failed:",
                error,
            );
        }
    }
}

function inferManagerTypeFromLegacy(
    legacy: Record<string, { managerType?: ManagerType }>,
): ManagerType | null {
    // Prefer hardware if any persisted context used it; otherwise software if any did.
    let saw: ManagerType | null = null;
    for (const entry of Object.values(legacy)) {
        if (entry?.managerType === "hardware") return "hardware";
        if (entry?.managerType === "software") saw = "software";
    }
    return saw;
}
