import crypto from "crypto";
import axios from "axios";
import { AppDataSource } from "../database/data-source";
import { DeadLetter } from "../database/entities/DeadLetter";
import { Delivery } from "../database/entities/Delivery";
import { Packet } from "../database/entities/Packet";
import { Subscription } from "../database/entities/Subscription";
import { WorkerHeartbeat } from "../database/entities/WorkerHeartbeat";
import { config } from "../config";
import { nextAttemptAt } from "../utils/backoff";
import type { AwarenessPayload } from "../types";

const BATCH_SIZE = 50;

function delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

function withDeadline<T>(promise: Promise<T>, ms: number): Promise<T> {
    return new Promise<T>((resolve, reject) => {
        const timer = setTimeout(
            () => reject(new Error(`delivery batch exceeded ${ms}ms deadline`)),
            ms,
        );
        promise.then(
            (value) => {
                clearTimeout(timer);
                resolve(value);
            },
            (error) => {
                clearTimeout(timer);
                reject(error);
            },
        );
    });
}

/**
 * Self-scheduling, lease-based delivery worker. No unresolved tick can disable
 * future polling: database calls have driver-level deadlines, each batch has a
 * hard deadline, and expired token-fenced leases are safe to reclaim.
 */
export class DeliveryEngine {
    private stopping = false;
    private loop?: Promise<void>;
    private watchdog?: NodeJS.Timeout;
    private activeTickStartedAt: Date | null = null;
    private readonly unsettledTicks = new Map<Promise<void>, Date>();

    start(): void {
        if (this.loop) return;
        this.stopping = false;
        this.loop = this.runLoop();
        this.watchdog = setInterval(() => {
            const starts = [
                ...(this.activeTickStartedAt ? [this.activeTickStartedAt] : []),
                ...this.unsettledTicks.values(),
            ];
            const oldest = starts.sort(
                (left, right) => left.getTime() - right.getTime(),
            )[0];
            if (
                oldest &&
                Date.now() - oldest.getTime() >
                    config.deliveryBatchTimeoutMs + config.dbQueryTimeoutMs
            ) {
                console.error(
                    `[aaas] worker watchdog: work has not returned since ${oldest.toISOString()}`,
                );
                process.exit(1);
            }
        }, config.workerHeartbeatMs);
        console.log(
            `[aaas] delivery worker ${config.workerId} started (poll ${config.deliveryPollMs}ms, lease ${config.deliveryLeaseMs}ms)`,
        );
    }

    async stop(): Promise<void> {
        this.stopping = true;
        if (this.watchdog) clearInterval(this.watchdog);
        await this.loop;
        this.loop = undefined;
    }

    private async runLoop(): Promise<void> {
        while (!this.stopping) {
            const tickStartedAt = new Date();
            this.activeTickStartedAt = tickStartedAt;
            let lastError: string | null = null;
            await this.writeHeartbeat(tickStartedAt, null, null);
            const tick = this.tick();
            this.unsettledTicks.set(tick, tickStartedAt);
            tick.then(
                () => this.unsettledTicks.delete(tick),
                () => this.unsettledTicks.delete(tick),
            );
            try {
                await withDeadline(tick, config.deliveryBatchTimeoutMs);
            } catch (error) {
                lastError = errorMessage(error);
                console.error(`[aaas] delivery tick failed: ${lastError}`);
            } finally {
                await this.writeHeartbeat(null, new Date(), lastError);
                this.activeTickStartedAt = null;
            }
            if (!this.stopping) await delay(config.deliveryPollMs);
        }
    }

    protected async writeHeartbeat(
        tickStartedAt: Date | null,
        lastCompletedAt: Date | null,
        lastError: string | null,
    ): Promise<void> {
        try {
            await AppDataSource.getRepository(WorkerHeartbeat).upsert(
                {
                    workerId: config.workerId,
                    heartbeatAt: new Date(),
                    tickStartedAt,
                    lastCompletedAt,
                    lastError,
                },
                ["workerId"],
            );
        } catch (error) {
            console.error(
                `[aaas] failed to persist worker heartbeat: ${errorMessage(error)}`,
            );
        }
    }

    protected async tick(): Promise<void> {
        const claimed = await this.claimBatch();
        const results = await Promise.allSettled(
            claimed.map((delivery) => this.attemptDelivery(delivery)),
        );
        for (let index = 0; index < results.length; index += 1) {
            const result = results[index];
            if (result.status === "fulfilled") continue;
            const delivery = claimed[index];
            const message = `delivery task failed unexpectedly: ${errorMessage(result.reason)}`;
            await this.rescheduleUnexpected(delivery, message);
            console.error(`[aaas] delivery ${delivery.id}: ${message}`);
        }
    }

    /** Atomically claim due rows with one token-fenced, expiring batch lease. */
    private async claimBatch(): Promise<Delivery[]> {
        const leaseToken = crypto.randomUUID();
        const leaseExpiresAt = new Date(Date.now() + config.deliveryLeaseMs);
        const result = await AppDataSource.getRepository(Delivery)
            .createQueryBuilder()
            .update(Delivery)
            .set({
                status: "delivering",
                leaseOwner: config.workerId,
                leaseToken,
                leaseExpiresAt,
            })
            .where(
                `id IN (
                    SELECT d.id FROM deliveries d
                    WHERE (
                        (d.status IN ('pending', 'failed') AND d."nextAttemptAt" <= now())
                        OR (d.status = 'delivering' AND d."leaseExpiresAt" <= now())
                    )
                    AND NOT EXISTS (
                        SELECT 1 FROM deliveries earlier
                        WHERE earlier."subscriptionId" = d."subscriptionId"
                          AND earlier."packetId" = d."packetId"
                          AND earlier.status IN ('pending', 'failed', 'delivering')
                          AND (
                            earlier."createdAt" < d."createdAt"
                            OR (earlier."createdAt" = d."createdAt" AND earlier.id < d.id)
                          )
                    )
                    ORDER BY d."nextAttemptAt", d."createdAt", d.id
                    LIMIT :limit
                    FOR UPDATE SKIP LOCKED
                )`,
                { limit: BATCH_SIZE },
            )
            .returning("*")
            .execute();
        return (result.raw ?? []) as Delivery[];
    }

    private async attemptDelivery(delivery: Delivery): Promise<void> {
        const subscription = await AppDataSource.getRepository(
            Subscription,
        ).findOne({ where: { id: delivery.subscriptionId } });
        const packet = delivery.payload
            ? null
            : await AppDataSource.getRepository(Packet).findOne({
                  where: { id: delivery.packetId },
              });

        if (!subscription || (!packet && !delivery.payload)) {
            await this.fail(
                delivery,
                subscription,
                "subscription or packet no longer exists",
                null,
                (delivery.payload ?? {}) as AwarenessPayload,
            );
            return;
        }

        const payload: AwarenessPayload = delivery.payload ?? {
            eventId: delivery.eventId,
            id: packet!.id,
            w3id: packet!.w3id,
            evaultPublicKey: packet!.evaultPublicKey,
            data: packet!.data,
            schemaId: packet!.ontology,
            operation: packet!.operation,
        };
        payload.eventId ??= delivery.eventId;

        const serializedPayload = JSON.stringify(payload);
        const headers: Record<string, string> = {
            "Content-Type": "application/json",
            "x-aaas-event-id": delivery.eventId,
        };
        if (subscription.secret) {
            headers["x-aaas-signature"] = crypto
                .createHmac("sha256", subscription.secret)
                .update(serializedPayload)
                .digest("hex");
        }

        try {
            const res = await axios.post(subscription.targetUrl, payload, {
                headers,
                timeout: 5000,
            });
            const update = await AppDataSource.getRepository(Delivery).update(
                { id: delivery.id, leaseToken: delivery.leaseToken! },
                {
                    status: "delivered",
                    attempts: Number(delivery.attempts) + 1,
                    deliveredAt: new Date(),
                    lastResponseStatus: res.status,
                    lastError: null,
                    leaseOwner: null,
                    leaseToken: null,
                    leaseExpiresAt: null,
                },
            );
            if (update.affected) {
                await AppDataSource.getRepository(DeadLetter).update(
                    { deliveryId: delivery.id },
                    { resolved: true },
                );
            }
        } catch (error: any) {
            await this.fail(
                delivery,
                subscription,
                error?.message ?? "unknown webhook delivery failure",
                error?.response?.status ?? null,
                payload,
            );
        }
    }

    private async rescheduleUnexpected(
        delivery: Delivery,
        message: string,
    ): Promise<void> {
        await AppDataSource.getRepository(Delivery).update(
            { id: delivery.id, leaseToken: delivery.leaseToken! },
            {
                status: "failed",
                lastError: message,
                nextAttemptAt: new Date(),
                leaseOwner: null,
                leaseToken: null,
                leaseExpiresAt: null,
            },
        );
    }

    private async fail(
        delivery: Delivery,
        subscription: Subscription | null,
        message: string,
        responseStatus: number | null,
        payload: AwarenessPayload,
    ): Promise<void> {
        const attempts = Number(delivery.attempts) + 1;
        const retryStartedAt = new Date(
            delivery.retryStartedAt ?? delivery.createdAt,
        ).getTime();
        const deadline = new Date(
            retryStartedAt + config.deliveryRetryWindowMs,
        );
        const now = new Date();

        if (now >= deadline) {
            await AppDataSource.transaction(async (manager) => {
                const update = await manager.getRepository(Delivery).update(
                    { id: delivery.id, leaseToken: delivery.leaseToken! },
                    {
                        status: "dead",
                        attempts,
                        lastError: message,
                        lastResponseStatus: responseStatus,
                        leaseOwner: null,
                        leaseToken: null,
                        leaseExpiresAt: null,
                    },
                );
                if (!update.affected) return;
                await manager
                    .getRepository(DeadLetter)
                    .createQueryBuilder()
                    .insert()
                    .values({
                        deliveryId: delivery.id,
                        subscriptionId: delivery.subscriptionId,
                        packetId: delivery.packetId,
                        consumerId:
                            subscription?.consumerId ?? delivery.subscriptionId,
                        payload: payload as any,
                        targetUrl: subscription?.targetUrl ?? "",
                        totalAttempts: attempts,
                        lastError: message,
                        lastResponseStatus: responseStatus,
                        resolved: false,
                    })
                    .orIgnore()
                    .execute();
                await manager.getRepository(DeadLetter).update(
                    { deliveryId: delivery.id },
                    {
                        subscriptionId: delivery.subscriptionId,
                        packetId: delivery.packetId,
                        consumerId:
                            subscription?.consumerId ?? delivery.subscriptionId,
                        payload: payload as any,
                        targetUrl: subscription?.targetUrl ?? "",
                        totalAttempts: attempts,
                        lastError: message,
                        lastResponseStatus: responseStatus,
                        resolved: false,
                    },
                );
            });
            console.warn(
                `[aaas] delivery ${delivery.id} dead-lettered after ${config.deliveryRetryWindowMs}ms retry window`,
            );
            return;
        }

        const scheduled = nextAttemptAt(attempts);
        const next = scheduled > deadline ? deadline : scheduled;
        await AppDataSource.getRepository(Delivery).update(
            { id: delivery.id, leaseToken: delivery.leaseToken! },
            {
                status: "failed",
                attempts,
                lastError: message,
                lastResponseStatus: responseStatus,
                nextAttemptAt: next,
                leaseOwner: null,
                leaseToken: null,
                leaseExpiresAt: null,
            },
        );
    }
}
