/**
 * Neo4j Migration: make User.eName unique
 *
 * The per-eName User node is the lock eVault manifests are pinned under, and
 * a concurrent MERGE only guarantees uniqueness when a constraint backs it.
 * Duplicate nodes left by earlier races are folded into one first, the old
 * plain index is dropped, and the constraint (which brings its own index)
 * replaces it.
 */

import type { Driver } from "neo4j-driver";

export async function createUserENameConstraint(driver: Driver): Promise<void> {
    const session = driver.session();
    try {
        await session.run(
            `MATCH (u:User)
             WHERE u.eName IS NOT NULL
             WITH u.eName AS eName, collect(u) AS nodes
             WHERE size(nodes) > 1
             WITH head(nodes) AS keep, tail(nodes) AS dupes
             UNWIND dupes AS d
             SET keep.publicKeys = reduce(
                     acc = coalesce(keep.publicKeys, []),
                     k IN coalesce(d.publicKeys, []) |
                     CASE WHEN k IN acc THEN acc ELSE acc + k END),
                 keep.vaultType = coalesce(keep.vaultType, d.vaultType),
                 keep.manifestId = coalesce(keep.manifestId, d.manifestId),
                 keep.manifestPinnedAt = coalesce(keep.manifestPinnedAt, d.manifestPinnedAt)
             DETACH DELETE d`,
        );
        await session.run(`DROP INDEX user_ename_index IF EXISTS`);
        await session.run(
            `CREATE CONSTRAINT user_ename_unique IF NOT EXISTS FOR (u:User) REQUIRE u.eName IS UNIQUE`,
        );
    } finally {
        await session.close();
    }
}
