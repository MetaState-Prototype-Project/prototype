/**
 * Neo4j Migration: Convert User.publicKey (string) to User.publicKeys (array)
 * 
 * This migration converts the single publicKey property to an array of publicKeys
 * to support multiple device installs per user.
 * 
 * For existing users with publicKey: converts to [publicKey]
 * For users without publicKey: initializes as []
 */

import { Driver } from "neo4j-driver";

export async function migratePublicKeyToArray(driver: Driver): Promise<void> {
    const session = driver.session();
    try {
        // First, convert existing publicKey (string) to publicKeys (array)
        // For users with publicKey, set publicKeys = [publicKey] and remove publicKey
        const result = await session.run(
            `MATCH (u:User)
             WHERE u.publicKey IS NOT NULL AND u.publicKeys IS NULL
             SET u.publicKeys = [u.publicKey]
             REMOVE u.publicKey
             RETURN count(u) as converted`
        );
        
        const converted = result.records[0]?.get("converted") || 0;
        console.log(`Converted ${converted} User nodes from publicKey to publicKeys array`);

        // For users without publicKey, initialize publicKeys as empty array
        const result2 = await session.run(
            `MATCH (u:User)
             WHERE u.publicKey IS NULL AND u.publicKeys IS NULL
             SET u.publicKeys = []
             RETURN count(u) as initialized`
        );
        
        const initialized = result2.records[0]?.get("initialized") || 0;
        console.log(`Initialized ${initialized} User nodes with empty publicKeys array`);

        console.log("Migration completed: publicKey -> publicKeys array");
    } catch (error) {
        console.error("Error migrating publicKey to publicKeys array:", error);
        throw error;
    } finally {
        await session.close();
    }
}

