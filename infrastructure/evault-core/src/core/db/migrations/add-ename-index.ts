/**
 * Neo4j Migration: Add eName index for multi-tenant performance
 * 
 * This migration creates an index on the eName property of MetaEnvelope nodes
 * to ensure optimal query performance for multi-tenant isolation.
 * 
 * Run this migration once to create the index:
 * ```cypher
 * CREATE INDEX eName_index FOR (m:MetaEnvelope) ON (m.eName)
 * ```
 */

import { Driver } from "neo4j-driver";

export async function createENameIndex(driver: Driver): Promise<void> {
    const session = driver.session();
    try {
        await session.run(
            `CREATE INDEX eName_index IF NOT EXISTS FOR (m:MetaEnvelope) ON (m.eName)`
        );
        console.log("Created eName index on MetaEnvelope nodes");
    } catch (error) {
        // Index might already exist, which is fine
        if (error instanceof Error && error.message.includes("already exists")) {
            console.log("eName index already exists");
        } else {
            console.error("Error creating eName index:", error);
            throw error;
        }
    } finally {
        await session.close();
    }
}

