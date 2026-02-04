/**
 * Neo4j Migration: Add indexes for EnvelopeOperationLog
 *
 * Creates indexes on eName and timestamp for paginated log queries.
 */

import { Driver } from "neo4j-driver";

export async function createEnvelopeOperationLogIndexes(
    driver: Driver,
): Promise<void> {
    const session = driver.session();
    try {
        await session.run(
            `CREATE INDEX envelope_operation_log_ename_index IF NOT EXISTS
             FOR (l:EnvelopeOperationLog) ON (l.eName)`,
        );
        console.log("Created eName index on EnvelopeOperationLog nodes");
        await session.run(
            `CREATE INDEX envelope_operation_log_timestamp_index IF NOT EXISTS
             FOR (l:EnvelopeOperationLog) ON (l.timestamp)`,
        );
        console.log("Created timestamp index on EnvelopeOperationLog nodes");
    } catch (error) {
        if (error instanceof Error && error.message.includes("already exists")) {
            console.log("EnvelopeOperationLog indexes already exist");
        } else {
            console.error("Error creating EnvelopeOperationLog indexes:", error);
            throw error;
        }
    } finally {
        await session.close();
    }
}
