import crypto from "crypto";
import axios from "axios";
import { AppDataSource } from "../database/data-source";
import { DeadLetter } from "../database/entities/DeadLetter";
import { Delivery } from "../database/entities/Delivery";
import { Packet } from "../database/entities/Packet";
import { Subscription } from "../database/entities/Subscription";
import { config } from "../config";
import { nextAttemptAt } from "../utils/backoff";
import type { AwarenessPayload } from "../types";

const BATCH_SIZE = 50;

/**
 * Background worker that drains the deliveries queue. Each tick atomically
 * claims a batch of due deliveries (FOR UPDATE SKIP LOCKED so concurrent ticks
 * never double-send), POSTs each to its subscription target, and either marks
 * it delivered or reschedules it with exponential backoff. Once a delivery
 * exhausts AWARENESS_MAX_ATTEMPTS it is written to the dead-letter table.
 */
export class DeliveryEngine {
    private timer?: NodeJS.Timeout;
    private running = false;

    start(): void {
        this.timer = setInterval(() => {
            void this.tick();
        }, config.deliveryPollMs);
        console.log(
            `[aaas] delivery engine started (poll ${config.deliveryPollMs}ms)`,
        );
    }

    stop(): void {
        if (this.timer) clearInterval(this.timer);
    }

    private async tick(): Promise<void> {
        if (this.running) return; // skip overlapping ticks
        this.running = true;
        try {
            const claimed = await this.claimBatch();
            for (const delivery of claimed) {
                await this.attemptDelivery(delivery);
            }
        } catch (err) {
            console.error("[aaas] delivery tick failed:", err);
        } finally {
            this.running = false;
        }
    }

    /** Atomically move a batch of due deliveries to `delivering`. */
    private async claimBatch(): Promise<Delivery[]> {
        // UPDATE ... RETURNING via the query builder so the returned rows are
        // exposed as a well-defined `.raw` array. The inner SELECT ... FOR
        // UPDATE SKIP LOCKED keeps the claim safe across concurrent ticks.
        const result = await AppDataSource.getRepository(Delivery)
            .createQueryBuilder()
            .update(Delivery)
            .set({ status: "delivering" })
            .where(
                `id IN (
                    SELECT id FROM deliveries
                    WHERE status IN ('pending', 'failed')
                      AND "nextAttemptAt" <= now()
                    ORDER BY "nextAttemptAt"
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
        if (!delivery?.id) {
            console.warn("[aaas] skipping delivery row with no id");
            return;
        }
        const subscription = await AppDataSource.getRepository(
            Subscription,
        ).findOne({ where: { id: delivery.subscriptionId } });
        const packet = await AppDataSource.getRepository(Packet).findOne({
            where: { id: delivery.packetId },
        });

        if (!subscription || !packet) {
            await this.fail(
                delivery,
                subscription,
                "subscription or packet no longer exists",
                null,
            );
            return;
        }

        const payload: AwarenessPayload = {
            id: packet.id,
            w3id: packet.w3id,
            evaultPublicKey: packet.evaultPublicKey,
            data: packet.data,
            schemaId: packet.ontology,
        };

        const headers: Record<string, string> = {
            "Content-Type": "application/json",
        };
        if (subscription.secret) {
            headers["x-aaas-signature"] = crypto
                .createHmac("sha256", subscription.secret)
                .update(JSON.stringify(payload))
                .digest("hex");
        }

        try {
            const res = await axios.post(subscription.targetUrl, payload, {
                headers,
                timeout: 5000,
            });
            await AppDataSource.getRepository(Delivery).update(delivery.id, {
                status: "delivered",
                attempts: delivery.attempts + 1,
                deliveredAt: new Date(),
                lastResponseStatus: res.status,
                lastError: null,
            });
        } catch (err: any) {
            const responseStatus = err?.response?.status ?? null;
            const message =
                err?.message ?? "unknown webhook delivery failure";
            await this.fail(delivery, subscription, message, responseStatus, {
                payload,
            });
        }
    }

    private async fail(
        delivery: Delivery,
        subscription: Subscription | null,
        message: string,
        responseStatus: number | null,
        ctx?: { payload: AwarenessPayload },
    ): Promise<void> {
        const attempts = delivery.attempts + 1;
        const deliveryRepo = AppDataSource.getRepository(Delivery);

        if (attempts >= config.maxAttempts) {
            await deliveryRepo.update(delivery.id, {
                status: "failed",
                attempts,
                lastError: message,
                lastResponseStatus: responseStatus,
            });
            await AppDataSource.getRepository(DeadLetter).insert({
                deliveryId: delivery.id,
                subscriptionId: delivery.subscriptionId,
                packetId: delivery.packetId,
                consumerId: subscription?.consumerId ?? delivery.subscriptionId,
                payload: (ctx?.payload ?? {}) as any,
                targetUrl: subscription?.targetUrl ?? "",
                totalAttempts: attempts,
                lastError: message,
                lastResponseStatus: responseStatus,
                resolved: false,
            });
            console.warn(
                `[aaas] delivery ${delivery.id} dead-lettered after ${attempts} attempts`,
            );
            return;
        }

        await deliveryRepo.update(delivery.id, {
            status: "failed",
            attempts,
            lastError: message,
            lastResponseStatus: responseStatus,
            nextAttemptAt: nextAttemptAt(attempts),
        });
    }
}
