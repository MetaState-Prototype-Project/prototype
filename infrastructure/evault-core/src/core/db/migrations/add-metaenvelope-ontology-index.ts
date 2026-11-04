/**
 * Neo4j Migration: Add an index on MetaEnvelope.ontology
 *
 * Group membership finds a group record by the vault it lives in or by the
 * `ename` field it states, so the one predicate both share is its ontology.
 * Without this index that lookup scans every MetaEnvelope, which takes seconds
 * in production and runs on every group-grant authorization.
 *
 * Envelope.value is deliberately not indexed instead: it holds arbitrary
 * payloads, and a value over the index key size limit would fail the write.
 */

import type { Driver } from "neo4j-driver";

export async function createMetaEnvelopeOntologyIndex(
    driver: Driver,
): Promise<void> {
    const session = driver.session();
    try {
        await session.run(
            "CREATE INDEX meta_envelope_ontology_index IF NOT EXISTS FOR (m:MetaEnvelope) ON (m.ontology)",
        );
    } finally {
        await session.close();
    }
}
