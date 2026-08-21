import type { ClientRegistry } from "./clients.js";
import type { BridgeConfig } from "./config.js";
import type { Keyring } from "./keys.js";
import type { Store } from "./store.js";
import type { SessionStreams } from "./w3ds/events.js";

/**
 * Everything the handlers need, passed in rather than imported.
 *
 * The point is testability: a handler can be exercised against a fake store and
 * a throwaway key pair without a server, an environment, or a running Forgejo.
 */
export interface LoginVerification {
    valid: boolean;
    error?: string;
}

export interface BridgeContext {
    config: BridgeConfig;
    keyring: Keyring;
    store: Store;
    clients: ClientRegistry;
    streams: SessionStreams;
    /**
     * Checks the wallet's signature against the Registry.
     *
     * Injected rather than imported so the flow's own protections — single-use
     * codes, exact redirect matching, the version gate — can be tested without a
     * Registry, an eVault, or a real key pair.
     */
    verifyLogin(input: {
        ename: string;
        session: string;
        signature: string;
    }): Promise<LoginVerification>;
}
