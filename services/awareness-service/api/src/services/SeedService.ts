import axios from "axios";
import { AppDataSource } from "../database/data-source";
import { Consumer } from "../database/entities/Consumer";
import { Subscription } from "../database/entities/Subscription";
import { AwarenessEvent } from "../database/entities/AwarenessEvent";
import { Delivery } from "../database/entities/Delivery";
import { config } from "../config";
import { contentHash } from "../utils/contentHash";
import type { AwarenessPayload } from "../types";

function safeOrigin(url: string | null): string | null {
    if (!url) return null;
    try {
        return new URL(url).origin;
    } catch {
        return null;
    }
}

/**
 * Backward-compat seeding. Before AaaS, evault-core fanned out every webhook to
 * every registered platform. To preserve that behaviour, on launch and at a
 * configured interval we ensure each platform currently in the registry has
 * an approved consumer and an active catch-all subscription (empty filters)
 * pointing at `<platform>/api/webhook`.
 *
 * Idempotent: valid existing catch-all subscriptions are reused.
 */
export class SeedService {
    private timer?: NodeJS.Timeout;
    private syncing = false;

    start(): void {
        if (!config.registryUrl || config.registrySyncMs <= 0) return;
        this.timer = setInterval(() => {
            void this.syncCatchAll().catch((err) => {
                console.error("[seed] registry reconciliation failed:", err);
            });
        }, config.registrySyncMs);
        console.log(
            `[seed] registry reconciliation started (poll ${config.registrySyncMs}ms)`,
        );
    }

    stop(): void {
        if (this.timer) clearInterval(this.timer);
    }

    /** Prevent overlapping registry requests when one reconciliation is slow. */
    async syncCatchAll(): Promise<{ seeded: number; total: number }> {
        if (this.syncing) return { seeded: 0, total: 0 };
        this.syncing = true;
        try {
            return await this.seedCatchAll();
        } finally {
            this.syncing = false;
        }
    }

    async seedCatchAll(): Promise<{ seeded: number; total: number }> {
        if (!config.registryUrl) {
            console.warn("[seed] PUBLIC_REGISTRY_URL not set, skipping");
            return { seeded: 0, total: 0 };
        }

        let platforms: string[] = [];
        try {
            const response = await axios.get(
                new URL("/platforms", config.registryUrl).toString(),
                { timeout: 10000 },
            );
            platforms = Array.isArray(response.data) ? response.data : [];
        } catch (err) {
            console.error("[seed] failed to fetch registry platforms:", err);
            return { seeded: 0, total: 0 };
        }

        const consumerRepo = AppDataSource.getRepository(Consumer);
        const subRepo = AppDataSource.getRepository(Subscription);
        let seeded = 0;
        const currentTargets = new Map<string, string>();

        for (const platformUrl of platforms) {
            let host: string;
            let targetUrl: string;
            try {
                host = new URL(platformUrl).host;
                targetUrl = new URL("/api/webhook", platformUrl).toString();
            } catch {
                console.warn(
                    `[seed] skipping invalid platform: ${platformUrl}`,
                );
                continue;
            }

            const ename = `catchall:${host}`;
            currentTargets.set(ename, targetUrl);
            let consumer = await consumerRepo.findOne({ where: { ename } });
            if (!consumer) {
                consumer = consumerRepo.create({
                    ename,
                    name: host,
                    status: "approved",
                    webhookBaseUrl: platformUrl,
                    approvedAt: new Date(),
                });
                await consumerRepo.save(consumer);
            } else {
                // Registry-level consumers are managed by this compatibility
                // sync. Keep them deliverable even if an earlier subscription
                // or consumer record was disabled.
                consumer.status = "approved";
                consumer.webhookBaseUrl = platformUrl;
                consumer.approvedAt ??= new Date();
                await consumerRepo.save(consumer);
            }

            const existing = await subRepo.findOne({
                where: {
                    consumerId: consumer.id,
                    isCatchAll: true,
                    targetUrl,
                },
            });
            if (!existing) {
                const created = await subRepo.save(
                    subRepo.create({
                        consumerId: consumer.id,
                        targetUrl,
                        ontologyFilter: [],
                        evaultFilter: [],
                        isCatchAll: true,
                        active: true,
                    }),
                );
                await this.queueLookback(created);
                seeded += 1;
            } else if (
                !existing.active ||
                existing.ontologyFilter.length > 0 ||
                existing.evaultFilter.length > 0
            ) {
                existing.active = true;
                existing.ontologyFilter = [];
                existing.evaultFilter = [];
                await subRepo.save(existing);
                await this.queueLookback(existing);
                seeded += 1;
            }
        }

        const managedSubscriptions = await subRepo
            .createQueryBuilder("s")
            .innerJoin(Consumer, "c", "c.id = s.consumerId")
            .addSelect("c.ename", "consumerEname")
            .where("s.isCatchAll = true")
            .andWhere("s.active = true")
            .andWhere("c.ename LIKE :prefix", { prefix: "catchall:%" })
            .getRawAndEntities();

        for (
            let index = 0;
            index < managedSubscriptions.entities.length;
            index += 1
        ) {
            const subscription = managedSubscriptions.entities[index];
            const ename = managedSubscriptions.raw[index]
                .consumerEname as string;
            if (currentTargets.get(ename) !== subscription.targetUrl) {
                subscription.active = false;
                await subRepo.save(subscription);
                seeded += 1;
            }
        }

        console.log(
            `[seed] catch-all reconciliation done: ${seeded} changed of ${platforms.length} platforms`,
        );
        return { seeded, total: platforms.length };
    }

    /** Fill the registry reconciliation window without replaying old history. */
    private async queueLookback(subscription: Subscription): Promise<void> {
        const since = new Date(Date.now() - config.deliveryRetryWindowMs);
        const targetOrigin = safeOrigin(subscription.targetUrl);
        const deliveryRepo = AppDataSource.getRepository(Delivery);
        let cursorReceivedAt: Date | null = null;
        let cursorEventId: string | null = null;

        for (;;) {
            const query = AppDataSource.getRepository(AwarenessEvent)
                .createQueryBuilder("e")
                .where("e.receivedAt >= :since", { since })
                .orderBy("e.receivedAt", "ASC")
                .addOrderBy("e.eventId", "ASC")
                .take(500);
            if (cursorReceivedAt && cursorEventId) {
                query.andWhere(
                    `(e.receivedAt > :cursorReceivedAt OR
                      (e.receivedAt = :cursorReceivedAt AND e.eventId > :cursorEventId))`,
                    { cursorReceivedAt, cursorEventId },
                );
            }
            const events = await query.getMany();
            if (events.length === 0) break;

            const rows = events
                .filter(
                    (event) =>
                        !targetOrigin ||
                        safeOrigin(event.requestingPlatform) !== targetOrigin,
                )
                .map((event) => {
                    const payload: AwarenessPayload = {
                        eventId: event.eventId,
                        id: event.packetId,
                        w3id: event.w3id,
                        evaultPublicKey: event.evaultPublicKey,
                        data: event.data,
                        schemaId: event.ontology,
                        operation: event.operation,
                        streamVersion: event.streamVersion,
                        occurredAt: event.occurredAt.toISOString(),
                    };
                    return deliveryRepo.create({
                        subscriptionId: subscription.id,
                        packetId: event.packetId,
                        eventId: event.eventId,
                        contentHash: contentHash(payload),
                        payload,
                        status: "pending",
                        attempts: 0,
                        nextAttemptAt: new Date(),
                        retryStartedAt: new Date(),
                    });
                });
            if (rows.length > 0) {
                await deliveryRepo
                    .createQueryBuilder()
                    .insert()
                    .values(rows)
                    .orIgnore()
                    .execute();
            }

            const last = events.at(-1)!;
            cursorReceivedAt = last.receivedAt;
            cursorEventId = last.eventId;
            if (events.length < 500) break;
        }
    }
}
