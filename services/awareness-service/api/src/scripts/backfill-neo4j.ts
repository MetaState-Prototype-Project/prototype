import "reflect-metadata";
import neo4j from "neo4j-driver";
import { AppDataSource } from "../database/data-source";
import { Packet } from "../database/entities/Packet";

/**
 * One-time backfill. AaaS runs on the same physical node as evault-core's Neo4j,
 * so this script reads MetaEnvelopes straight from the graph and seeds the
 * `packets` table. It is idempotent (upsert keyed on packet id) and re-runnable.
 *
 * It seeds the packet store ONLY - it deliberately does not create deliveries,
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
    const uri = process.env.AWARENESS_NEO4J_URI ?? "bolt://localhost:7687";
    const user = process.env.AWARENESS_NEO4J_USER ?? "neo4j";
    const password = process.env.AWARENESS_NEO4J_PASSWORD ?? "neo4j";
    const evaultPublicKey = process.env.EVAULT_PUBLIC_KEY ?? null;

    const driver = neo4j.driver(uri, neo4j.auth.basic(user, password));
    await AppDataSource.initialize();
    const packetRepo = AppDataSource.getRepository(Packet);
    const backfillTs = new Date();

    let skip = 0;
    let total = 0;

    try {
        for (;;) {
            const session = driver.session();
            let rows: any[];
            try {
                const result = await session.run(
                    `MATCH (m:MetaEnvelope)-[:LINKS_TO]->(e:Envelope)
                     RETURN m.id AS id, m.ontology AS ontology, m.eName AS eName,
                            collect({ontology: e.ontology, value: e.value, valueType: e.valueType}) AS envelopes
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

            const packets = rows
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
                    return packetRepo.create({
                        id: row.id,
                        ontology: row.ontology,
                        w3id: row.eName ?? null,
                        evaultPublicKey,
                        data,
                        operation: "create" as const,
                        receivedAt: backfillTs,
                    });
                });

            if (packets.length > 0) {
                await packetRepo.upsert(packets, ["id"]);
                total += packets.length;
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
