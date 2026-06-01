import {
    KeyManagerError,
    KeyManagerFactory,
    migrateLegacySoftwareKey,
} from "$lib/crypto";
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
 * are forced onto software so they don't pollute the hardware keystore. If a
 * device probes as hardware-capable but then fails to *generate* a key (e.g. an
 * Android phone with no StrongBox secure element), ensureKey demotes the wallet
 * to software keys so the user is never hard-blocked.
 *
 * Operational failures are different: signing flows through #withEvaultSync,
 * which on failure checks whether the local key matches what the eVault has
 * bound; if not, syncs and retries once. A genuine failure after that is
 * surfaced to the caller — no silent fallback or key-type switch mid-life.
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

        try {
            await manager.generate();
            return { created: true };
        } catch (error) {
            // The hardware manager can pass the availability probe (the native
            // `exists` check never touches the secure element) yet still fail to
            // *generate* — e.g. Android phones that expose a keystore but have
            // no StrongBox secure element, which the native plugin requires.
            // Rather than hard-blocking the user (this is the "Couldn't restore
            // your eVault" failure during recovery), demote to software keys and
            // generate there. Pre-verification users already run on software, so
            // this is the same well-trodden path. Safe because the device key is
            // generated fresh here and is not yet bound to the eVault — there is
            // no in-use key to invalidate.
            if (this.#managerType !== "hardware") throw error;

            console.warn(
                "[KeyService] Hardware key generation failed; falling back to software keys:",
                error,
            );
            const software = await this.#demoteToSoftware();
            if (await software.exists()) return { created: false };
            await software.generate();
            return { created: true };
        }
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
     * Switch this wallet to software keys after hardware generation fails and
     * persist the choice so later sessions skip the hardware path entirely.
     */
    async #demoteToSoftware(): Promise<KeyManager> {
        this.#managerType = "software";
        this.#manager = KeyManagerFactory.get("software");
        await this.#store.set(MANAGER_TYPE_KEY, "software");
        return this.#manager;
    }

    /**
     * Recover from an unusable signing key by rotating onto a fresh software
     * key. Hardware is what failed (and the plugin can't delete a keystore
     * alias from JS), so recovery always lands on software. The caller is
     * responsible for (re)binding the new key to the eVault.
     */
    async #rotateToFreshKey(): Promise<void> {
        await this.#demoteToSoftware();
        await KeyManagerFactory.getSoftware().regenerate();
    }

    /**
     * Run a key operation with self-healing. On failure:
     *  1. If the local key is usable but not yet registered on the eVault, bind
     *     it and retry once.
     *  2. If the local key itself is unusable — the common failure on Android
     *     devices whose OS evicts/invalidates keystore entries, where the key
     *     still "exists" and its public key may still be bound but can no longer
     *     sign — rotate onto a fresh software key, (re)bind it (additive: the
     *     dead key is left in place but is inert), and retry once.
     * If neither remedy resolves it, the original error stands.
     */
    async #withEvaultSync<T>(op: () => Promise<T>): Promise<T> {
        try {
            return await op();
        } catch (firstError) {
            if (!this.#evaultSyncHandler) {
                throw firstError;
            }

            // Remedy 1: the local key works but isn't registered on the eVault
            // yet — bind it and retry. If the key is unreadable or the retry
            // still fails, fall through to rotation.
            if (this.#evaultKeyResolver) {
                try {
                    const localPk = await this.getPublicKey();
                    const bound = await this.#evaultKeyResolver();
                    if (!bound.includes(localPk)) {
                        console.warn(
                            "[KeyService] Local key not bound on eVault; syncing and retrying",
                        );
                        if (await this.#evaultSyncHandler()) {
                            return await op();
                        }
                    }
                } catch (rebindError) {
                    console.warn(
                        "[KeyService] eVault re-bind did not resolve the failure:",
                        rebindError,
                    );
                }
            }

            // Remedy 2: the local key can't perform the operation (e.g. a
            // hardware key the OS evicted). Only attempt this for genuine key
            // failures. Rotate to a fresh software key, bind it, retry once.
            if (firstError instanceof KeyManagerError) {
                console.warn(
                    "[KeyService] Signing key unusable; rotating to a fresh key and re-binding:",
                    firstError,
                );
                try {
                    await this.#rotateToFreshKey();
                    if (await this.#evaultSyncHandler()) {
                        return await op();
                    }
                    console.error(
                        "[KeyService] failed to bind rotated key to eVault",
                    );
                } catch (rotateError) {
                    console.warn(
                        "[KeyService] key rotation recovery failed:",
                        rotateError,
                    );
                }
            }

            throw firstError;
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
