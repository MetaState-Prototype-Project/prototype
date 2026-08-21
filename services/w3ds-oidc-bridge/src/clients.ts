import { createHash, timingSafeEqual } from "node:crypto";
import type { BridgeConfig } from "./config.js";

export interface OidcClient {
    clientId: string;
    clientSecret: string;
    /** The one registered callback. Compared exactly; never by prefix. */
    redirectUri: string;
}

export interface ClientRegistry {
    find(clientId: string | undefined): OidcClient | undefined;
    /**
     * Whether a presented secret matches, in time independent of how much of it
     * is correct.
     */
    authenticate(
        client: OidcClient,
        presentedSecret: string | undefined,
    ): boolean;
}

/**
 * One client: GitW3.
 *
 * Isolated behind a lookup so a second client is a change to this file and
 * nothing else. There is no dynamic registration and no plan for one — a bridge
 * that anyone can register against is a bridge that anyone can obtain an
 * identity assertion from.
 */
export function createClientRegistry(config: BridgeConfig): ClientRegistry {
    const client: OidcClient = {
        clientId: config.clientId,
        clientSecret: config.clientSecret,
        redirectUri: config.redirectUri,
    };

    return {
        find(clientId) {
            return clientId === client.clientId ? client : undefined;
        },

        authenticate(target, presentedSecret) {
            if (!presentedSecret) return false;
            // Hash both sides first: timingSafeEqual throws on a length mismatch,
            // which would itself leak the length of the real secret.
            const expected = createHash("sha256")
                .update(target.clientSecret)
                .digest();
            const presented = createHash("sha256")
                .update(presentedSecret)
                .digest();
            return timingSafeEqual(expected, presented);
        },
    };
}
