import { AppDataSource } from "../database/data-source";
import { Delivery } from "../database/entities/Delivery";
import { AwarenessEvent } from "../database/entities/AwarenessEvent";
import { Packet } from "../database/entities/Packet";
import type { AwarenessPayload } from "../types";
import { contentHash, stableStringify } from "../utils/contentHash";
import { SubscriptionMatcher } from "./SubscriptionMatcher";

/** Returns the normalised origin of a URL, or null if it cannot be parsed. */
function safeOrigin(url: string): string | null {
    try {
        return new URL(url).origin;
    } catch {
        return null;
    }
}

function eventFingerprint(input: {
    packetId: string;
    ontology: string;
    evaultPublicKey?: string | null;
    w3id?: string | null;
    data?: unknown;
    operation?: string;
    streamVersion?: number | string | null;
    requestingPlatform?: string | null;
}): string {
    return stableStringify({
        packetId: input.packetId,
        ontology: input.ontology,
        evaultPublicKey: input.evaultPublicKey ?? null,
        w3id: input.w3id ?? null,
        data: input.data ?? null,
        operation: input.operation ?? "create",
        streamVersion:
            input.streamVersion === null || input.streamVersion === undefined
                ? null
                : String(input.streamVersion),
        requestingPlatform: input.requestingPlatform ?? null,
    });
}

export class EventIdConflictError extends Error {
    constructor(eventId: string) {
        super(`eventId ${eventId} was already used for a different event`);
        this.name = "EventIdConflictError";
    }
}

/**
 * Persists an incoming awareness packet and queues a webhook delivery for every
 * subscription that matches it. Re-ingesting the same source event is
 * idempotent; reusing an event id for different content is rejected.
 */
export class IngestService {
    private matcher = new SubscriptionMatcher();

    async ingest(payload: AwarenessPayload): Promise<{
        packetId: string;
        eventId: string;
        duplicate: boolean;
        deliveriesQueued: number;
    }> {
        const deliveryPayload: AwarenessPayload = {
            eventId: payload.eventId,
            id: payload.id,
            w3id: payload.w3id ?? null,
            evaultPublicKey: payload.evaultPublicKey ?? null,
            data: payload.data ?? null,
            schemaId: payload.schemaId,
            operation: payload.operation ?? "create",
            streamVersion: payload.streamVersion ?? null,
            occurredAt: payload.occurredAt,
        };
        // Legacy callers have no source event id. Preserve their old retry
        // idempotency until every eVault has rolled onto the durable outbox.
        const eventId =
            payload.eventId ?? `legacy:${contentHash(deliveryPayload)}`;
        deliveryPayload.eventId = eventId;
        const occurredAt = payload.occurredAt
            ? new Date(payload.occurredAt)
            : new Date();
        if (Number.isNaN(occurredAt.getTime())) {
            throw new Error("occurredAt must be an ISO timestamp");
        }

        return AppDataSource.transaction(async (manager) => {
            const packetRepo = manager.getRepository(Packet);
            const packet = packetRepo.create({
                id: payload.id,
                ontology: payload.schemaId,
                evaultPublicKey: payload.evaultPublicKey ?? null,
                w3id: payload.w3id ?? null,
                data: payload.data ?? null,
                operation: payload.operation ?? "create",
                receivedAt: new Date(),
            });

            const insertEvent = await manager
                .getRepository(AwarenessEvent)
                .createQueryBuilder()
                .insert()
                .values({
                    eventId,
                    packetId: payload.id,
                    ontology: payload.schemaId,
                    evaultPublicKey: payload.evaultPublicKey ?? null,
                    w3id: payload.w3id ?? null,
                    data: (payload.data ?? null) as any,
                    operation: payload.operation ?? "create",
                    streamVersion:
                        payload.streamVersion === null ||
                        payload.streamVersion === undefined
                            ? null
                            : String(payload.streamVersion),
                    requestingPlatform: payload.requestingPlatform ?? null,
                    occurredAt,
                    receivedAt: new Date(),
                })
                .orIgnore()
                .returning('"eventId"')
                .execute();

            if ((insertEvent.raw ?? []).length === 0) {
                const existing = await manager
                    .getRepository(AwarenessEvent)
                    .findOneByOrFail({ eventId });
                const incomingFingerprint = eventFingerprint({
                    packetId: payload.id,
                    ontology: payload.schemaId,
                    evaultPublicKey: payload.evaultPublicKey,
                    w3id: payload.w3id,
                    data: payload.data,
                    operation: payload.operation,
                    streamVersion: payload.streamVersion,
                    requestingPlatform: payload.requestingPlatform,
                });
                const existingFingerprint = eventFingerprint({
                    packetId: existing.packetId,
                    ontology: existing.ontology,
                    evaultPublicKey: existing.evaultPublicKey,
                    w3id: existing.w3id,
                    data: existing.data,
                    operation: existing.operation,
                    streamVersion: existing.streamVersion,
                    requestingPlatform: existing.requestingPlatform,
                });
                if (incomingFingerprint !== existingFingerprint) {
                    throw new EventIdConflictError(eventId);
                }
                return {
                    packetId: payload.id,
                    eventId,
                    duplicate: true,
                    deliveriesQueued: 0,
                };
            }

            await packetRepo.upsert(packet, ["id"]);
            let subscriptions = await this.matcher.match(packet, manager);

            if (payload.requestingPlatform) {
                const origin = safeOrigin(payload.requestingPlatform);
                if (origin) {
                    subscriptions = subscriptions.filter(
                        (sub) => safeOrigin(sub.targetUrl) !== origin,
                    );
                }
            }

            if (subscriptions.length === 0) {
                return {
                    packetId: payload.id,
                    eventId,
                    duplicate: false,
                    deliveriesQueued: 0,
                };
            }

            const hash = contentHash(deliveryPayload);
            const deliveryRepo = manager.getRepository(Delivery);
            const rows = subscriptions.map((sub) =>
                deliveryRepo.create({
                    subscriptionId: sub.id,
                    packetId: payload.id,
                    eventId,
                    contentHash: hash,
                    payload: deliveryPayload,
                    status: "pending",
                    attempts: 0,
                    nextAttemptAt: new Date(),
                    retryStartedAt: new Date(),
                }),
            );
            const result = await deliveryRepo
                .createQueryBuilder()
                .insert()
                .values(rows)
                .orIgnore()
                .execute();

            return {
                packetId: payload.id,
                eventId,
                duplicate: false,
                deliveriesQueued: result.identifiers.filter(Boolean).length,
            };
        });
    }
}
