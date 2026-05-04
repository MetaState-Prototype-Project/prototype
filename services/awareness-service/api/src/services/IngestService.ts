import { AppDataSource } from "../database/data-source";
import { Delivery } from "../database/entities/Delivery";
import { Packet } from "../database/entities/Packet";
import type { AwarenessPayload } from "../types";
import { SubscriptionMatcher } from "./SubscriptionMatcher";

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

        const subscriptions = await this.matcher.match(packet);
        if (subscriptions.length === 0) {
            return { packetId: packet.id, deliveriesQueued: 0 };
        }

        const deliveryRepo = AppDataSource.getRepository(Delivery);
        const rows = subscriptions.map((sub) =>
            deliveryRepo.create({
                subscriptionId: sub.id,
                packetId: packet.id,
                status: "pending",
                attempts: 0,
                nextAttemptAt: new Date(),
            }),
        );

        // orIgnore skips deliveries that already exist for this packet/sub pair,
        // so an evault-core retry of POST /ingest does not double-deliver.
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
