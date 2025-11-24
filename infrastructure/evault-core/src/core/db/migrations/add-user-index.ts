/**
 * Neo4j Migration: Add User node index for eName property
 * 
 * This migration creates an index on the eName property of User nodes
 * to ensure optimal query performance for public key lookups.
 * 
 * Run this migration once to create the index:
 * ```cypher
 * CREATE INDEX user_ename_index FOR (u:User) ON (u.eName)
 * ```
 */

import { Driver } from "neo4j-driver";

export async function createUserIndex(driver: Driver): Promise<void> {
    const session = driver.session();
    try {
        await session.run(
            `CREATE INDEX user_ename_index IF NOT EXISTS FOR (u:User) ON (u.eName)`
        );
        console.log("Created User eName index");
    } catch (error) {
        // Index might already exist, which is fine
        if (error instanceof Error && error.message.includes("already exists")) {
            console.log("User eName index already exists");
        } else {
            console.error("Error creating User eName index:", error);
            throw error;
        }
    } finally {
        await session.close();
    }
}

