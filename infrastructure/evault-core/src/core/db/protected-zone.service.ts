import type { Driver } from "neo4j-driver";
import { comparePassphrase, hashPassphrase } from "../utils/passphrase";

/**
 * ProtectedZoneService manages data stored in `:ProtectedZone` Neo4j nodes.
 *
 * These nodes are intentionally isolated from the regular MetaEnvelope graph
 * and are never reachable through any GraphQL query or mutation — they exist
 * only as a target for internal server-side operations (set, compare).
 *
 * The passphrase itself is never stored; only its PBKDF2-SHA512 hash is kept.
 */
export class ProtectedZoneService {
    private driver: Driver;

    constructor(driver: Driver) {
        this.driver = driver;
    }

    private async run(query: string, params: Record<string, any> = {}) {
        const session = this.driver.session();
        try {
            return await session.run(query, params);
        } finally {
            await session.close();
        }
    }

    /**
     * Stores (or replaces) the recovery passphrase hash for a given eName.
     * Only the hash is persisted — the plain-text passphrase is not stored.
     */
    async setPassphraseHash(eName: string, passphrase: string): Promise<void> {
        const hash = await hashPassphrase(passphrase);
        await this.run(
            `MERGE (pz:ProtectedZone { eName: $eName })
             SET pz.passphraseHash = $hash, pz.updatedAt = $now`,
            { eName, hash, now: new Date().toISOString() },
        );
    }

    /**
     * Returns true if a ProtectedZone node with a passphrase hash exists for this eName.
     */
    async hasPassphraseHash(eName: string): Promise<boolean> {
        const result = await this.run(
            `MATCH (pz:ProtectedZone { eName: $eName })
             WHERE pz.passphraseHash IS NOT NULL
             RETURN pz LIMIT 1`,
            { eName },
        );
        return result.records.length > 0;
    }

    /**
     * Compares a candidate passphrase against the stored hash.
     * Returns null if no hash is set for the eName.
     * The actual hash value is never returned to the caller.
     */
    async verifyPassphrase(eName: string, candidate: string): Promise<boolean | null> {
        const result = await this.run(
            `MATCH (pz:ProtectedZone { eName: $eName })
             WHERE pz.passphraseHash IS NOT NULL
             RETURN pz.passphraseHash AS hash LIMIT 1`,
            { eName },
        );

        if (result.records.length === 0) return null;

        const stored: string = result.records[0].get("hash");
        return comparePassphrase(candidate, stored);
    }
}
