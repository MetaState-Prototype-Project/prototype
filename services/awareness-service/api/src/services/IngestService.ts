import { AppDataSource } from "../database/data-source";
import { Delivery } from "../database/entities/Delivery";
import { Packet } from "../database/entities/Packet";
import type { AwarenessPayload } from "../types";
import { contentHash } from "../utils/contentHash";
import { SubscriptionMatcher } from "./SubscriptionMatcher";

/** Returns the normalised origin of a URL, or null if it cannot be parsed. */
function safeOrigin(url: string): string | null {
    try {
        return new URL(url).origin;
    } catch {
        return null;
    }
}

/**
 * Persists an incoming awareness packet and queues a webhook delivery for every
 * subscription that matches it. Re-ingesting the same packet is idempotent: the
 * packet is upserted and duplicate deliveries are skipped by a unique
 * (subscriptionId, packetId) constraint.
 */
export class IngestService {
    private matcher = new SubscriptionMatcher();

    async ingest(
        payload: AwarenessPayload,
    ): Promise<{ packetId: string; deliveriesQueued: number }> {
        const packetRepo = AppDataSource.getRepository(Packet);

        const packet = packetRepo.create({
            id: payload.id,
            ontology: payload.schemaId,
            evaultPublicKey: payload.evaultPublicKey ?? null,
            w3id: payload.w3id ?? null,
            data: payload.data ?? null,
            operation: payload.operation ?? "create",
            receivedAt: new Date(),
        });

        await packetRepo.upsert(packet, ["id"]);

        let subscriptions = await this.matcher.match(packet);

        // Skip delivering the packet back to the platform that triggered it -
        // the same ping-pong guard evault-core's old fanout enforced.
        if (payload.requestingPlatform) {
            const origin = safeOrigin(payload.requestingPlatform);
            if (origin) {
                subscriptions = subscriptions.filter(
                    (sub) => safeOrigin(sub.targetUrl) !== origin,
                );
            }
        }

        if (subscriptions.length === 0) {
            return { packetId: packet.id, deliveriesQueued: 0 };
        }

        // Dedupe deliveries by payload content rather than packet id alone:
        // re-ingesting an updated envelope (new hash) must queue a new delivery,
        // while a retried POST of the same payload (same hash) must not.
        const hash = contentHash(payload.data ?? null);

        const deliveryRepo = AppDataSource.getRepository(Delivery);
        const rows = subscriptions.map((sub) =>
            deliveryRepo.create({
                subscriptionId: sub.id,
                packetId: packet.id,
                contentHash: hash,
                status: "pending",
                attempts: 0,
                nextAttemptAt: new Date(),
            }),
        );

        // orIgnore skips deliveries that already exist for this
        // (subscription, packet, content) triple, so an evault-core retry of
        // POST /ingest with unchanged data does not double-deliver. An updated
        // payload has a different contentHash and is inserted as a new delivery.
        const result = await deliveryRepo
            .createQueryBuilder()
            .insert()
            .into(Delivery)
            .values(rows)
            .orIgnore()
            .execute();

        return {
            packetId: packet.id,
            deliveriesQueued: result.identifiers.filter(Boolean).length,
        };
    }
}
