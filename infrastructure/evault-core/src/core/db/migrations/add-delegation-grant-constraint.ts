import type { Driver } from "neo4j-driver";

/**
 * Each signed company-authority grant may be used for one record only. The
 * constraint makes the delegation guard's claim (a MERGE) race-safe.
 */
export async function createDelegationGrantConstraint(
    driver: Driver,
): Promise<void> {
    const session = driver.session();
    try {
        await session.run(
            "CREATE CONSTRAINT delegation_grant_payload IF NOT EXISTS FOR (g:DelegationGrant) REQUIRE (g.eName, g.payloadSha256) IS UNIQUE",
        );
        await session.run(
            "CREATE INDEX delegation_grant_claim IF NOT EXISTS FOR (g:DelegationGrant) ON (g.claimToken)",
        );
    } finally {
        await session.close();
    }
}
