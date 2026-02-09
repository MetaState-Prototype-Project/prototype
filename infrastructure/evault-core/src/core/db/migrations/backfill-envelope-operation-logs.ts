/**
 * One-time backfill: create EnvelopeOperationLog entries for existing MetaEnvelopes.
 * Platform is inferred from ontology (blabsy for socials, etc.). Run only once per evault.
 */

import type { Driver } from "neo4j-driver";
import { DbService } from "../db.service";
import { computeEnvelopeHash } from "../envelope-hash";
import { inferPlatformFromOntology } from "../ontology-platform";
import { W3IDBuilder } from "w3id";

const BACKFILL_MARKER = "backfill-envelope-logs-v1";

export async function backfillEnvelopeOperationLogs(
    driver: Driver,
): Promise<void> {
    const session = driver.session();
    try {
        const check = await session.run(
            `MATCH (m:BackfillEnvelopeLogsDone { id: $id }) RETURN m.id AS id`,
            { id: BACKFILL_MARKER },
        );
        if (check.records.length > 0) {
            console.log(
                "Envelope operation logs backfill already run, skipping.",
            );
            return;
        }

        const dbService = new DbService(driver);
        const eNamesResult = await session.run(
            `MATCH (m:MetaEnvelope) RETURN DISTINCT m.eName AS eName`,
            {},
        );
        const eNames = eNamesResult.records.map((r) => r.get("eName") as string);
        const timestamp = new Date().toISOString();
        let created = 0;

        for (const eName of eNames) {
            const metaEnvelopes =
                await dbService.findAllMetaEnvelopesByEName(eName);
            for (const meta of metaEnvelopes) {
                const payload = meta.parsed as Record<string, unknown>;
                const envelopeHash = computeEnvelopeHash({
                    id: meta.id,
                    ontology: meta.ontology,
                    payload,
                });
                const platform = inferPlatformFromOntology(meta.ontology);
                const logId = (await new W3IDBuilder().build()).id;
                await session.run(
                    `
                    CREATE (l:EnvelopeOperationLog {
                        id: $id,
                        eName: $eName,
                        metaEnvelopeId: $metaEnvelopeId,
                        envelopeHash: $envelopeHash,
                        operation: $operation,
                        platform: $platform,
                        timestamp: $timestamp,
                        ontology: $ontology
                    })
                    `,
                    {
                        id: logId,
                        eName,
                        metaEnvelopeId: meta.id,
                        envelopeHash,
                        operation: "create",
                        platform,
                        timestamp,
                        ontology: meta.ontology,
                    },
                );
                created++;
            }
        }

        await session.run(
            `CREATE (m:BackfillEnvelopeLogsDone { id: $id })`,
            { id: BACKFILL_MARKER },
        );
        console.log(
            `Envelope operation logs backfill complete: ${created} log entries created.`,
        );
    } finally {
        await session.close();
    }
}
