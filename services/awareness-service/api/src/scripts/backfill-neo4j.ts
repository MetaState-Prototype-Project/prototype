import "reflect-metadata";
import neo4j from "neo4j-driver";
import { AppDataSource } from "../database/data-source";
import { AwarenessEvent } from "../database/entities/AwarenessEvent";
import { Packet } from "../database/entities/Packet";

/**
 * One-time backfill. AaaS runs on the same physical node as evault-core's Neo4j,
 * so this script reads MetaEnvelopes straight from the graph and seeds the
 * latest-state `packets` projection and immutable event history. It is
 * idempotent (stable event id and packet upsert) and re-runnable.
 *
 * It deliberately does not create deliveries,
 * which would spam subscribers with the entire history on go-live.
 */

const BATCH = 500;

/** Mirrors evault-core's deserializeValue for backfilled envelope values. */
function deserialize(value: unknown, type: string): unknown {
    if (type === "object" && typeof value === "string") {
        try {
            return JSON.parse(value);
        } catch {
            return value;
        }
    }
    if (type === "array" && typeof value === "string") {
        try {
            return JSON.parse(value);
        } catch {
            return value;
        }
    }
    return value;
}

async function main(): Promise<void> {
    // Reuse evault-core's own Neo4j connection vars from the root .env -
    // AaaS runs on the same node, so it reads the same graph.
    const uri = process.env.NEO4J_URI ?? "bolt://localhost:7687";
    const user = process.env.NEO4J_USER ?? "neo4j";
    const password = process.env.NEO4J_PASSWORD ?? "neo4j";
    const evaultPublicKey = process.env.EVAULT_PUBLIC_KEY ?? null;

    const driver = neo4j.driver(uri, neo4j.auth.basic(user, password));
    await AppDataSource.initialize();
    const backfillTs = new Date();

    let skip = 0;
    let total = 0;

    try {
        for (;;) {
            const session = driver.session();
            let rows: any[];
            try {
                const result = await session.run(
                    `MATCH (m:MetaEnvelope)
                     OPTIONAL MATCH (m)-[:LINKS_TO]->(e:Envelope)
                     RETURN m.id AS id, m.ontology AS ontology, m.eName AS eName,
                            collect(CASE WHEN e IS NULL THEN null ELSE {ontology: e.ontology, value: e.value, valueType: e.valueType} END) AS envelopes
                     ORDER BY id, eName
                     SKIP $skip LIMIT $batch`,
                    { skip: neo4j.int(skip), batch: neo4j.int(BATCH) },
                );
                rows = result.records.map((r) => ({
                    id: r.get("id"),
                    ontology: r.get("ontology"),
                    eName: r.get("eName"),
                    envelopes: r.get("envelopes"),
                }));
            } finally {
                await session.close();
            }

            if (rows.length === 0) break;

            const snapshots = rows
                .filter((row) => row.id && row.ontology)
                .map((row) => {
                    const data: Record<string, unknown> = {};
                    for (const env of row.envelopes ?? []) {
                        if (env?.ontology) {
                            data[env.ontology] = deserialize(
                                env.value,
                                env.valueType,
                            );
                        }
                    }
                    return { row, data };
                });

            // The graph can hold several MetaEnvelope nodes with the same id
            // (e.g. shared across eNames). Postgres rejects an upsert that
            // touches the same conflict target twice in one statement, so
            // collapse duplicates within the batch first (last write wins).
            const deduped = Array.from(
                new Map(
                    snapshots.map((snapshot) => [snapshot.row.id, snapshot]),
                ).values(),
            );

            if (deduped.length > 0) {
                await AppDataSource.transaction(async (manager) => {
                    const packetRepo = manager.getRepository(Packet);
                    await packetRepo.upsert(
                        deduped.map(({ row, data }) =>
                            packetRepo.create({
                                id: row.id,
                                ontology: row.ontology,
                                w3id: row.eName ?? null,
                                evaultPublicKey,
                                data: data as any,
                                operation: "create" as const,
                                receivedAt: backfillTs,
                            }),
                        ),
                        ["id"],
                    );
                    await manager
                        .getRepository(AwarenessEvent)
                        .createQueryBuilder()
                        .insert()
                        .values(
                            deduped.map(({ row, data }) => ({
                                eventId: `legacy-packet:${row.id}`,
                                packetId: row.id,
                                ontology: row.ontology,
                                w3id: row.eName ?? null,
                                evaultPublicKey,
                                data: data as any,
                                operation: "create" as const,
                                streamVersion: null,
                                requestingPlatform: null,
                                occurredAt: backfillTs,
                                receivedAt: backfillTs,
                            })),
                        )
                        .orIgnore()
                        .execute();
                });
                total += deduped.length;
            }
            console.log(`[backfill] processed ${total} packets...`);
            skip += BATCH;
        }

        console.log(`[backfill] complete: ${total} packets seeded`);
    } finally {
        await driver.close();
        await AppDataSource.destroy();
    }
}

main().catch((err) => {
    console.error("[backfill] failed:", err);
    process.exit(1);
});
