import type { Driver } from "neo4j-driver";

export async function createAwarenessOutboxIndexes(
    driver: Driver,
): Promise<void> {
    const session = driver.session();
    try {
        await session.run(
            "CREATE CONSTRAINT awareness_stream_packet_id IF NOT EXISTS FOR (s:AwarenessStream) REQUIRE s.packetId IS UNIQUE",
        );
        await session.run(
            "CREATE CONSTRAINT awareness_outbox_event_id IF NOT EXISTS FOR (a:AwarenessOutbox) REQUIRE a.eventId IS UNIQUE",
        );
        await session.run(
            "CREATE INDEX awareness_outbox_due IF NOT EXISTS FOR (a:AwarenessOutbox) ON (a.status, a.nextAttemptAt)",
        );
        // Lease recovery reads its own index rather than OR-ing onto the due
        // one, which no index can serve. Outbox rows are created without the
        // lease properties and finish() sets them back to null (Neo4j removes
        // the property), so this index only ever holds rows currently leased -
        // it stays small however large the outbox grows.
        await session.run(
            "CREATE INDEX awareness_outbox_lease IF NOT EXISTS FOR (a:AwarenessOutbox) ON (a.status, a.leaseExpiresAt)",
        );
        await session.run(
            "CREATE INDEX awareness_outbox_stream IF NOT EXISTS FOR (a:AwarenessOutbox) ON (a.packetId, a.status, a.streamVersion)",
        );
    } finally {
        await session.close();
    }
}
