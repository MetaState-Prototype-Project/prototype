import axios from "axios";
import { AppDataSource } from "../database/data-source";
import { Consumer } from "../database/entities/Consumer";
import { Subscription } from "../database/entities/Subscription";
import { config } from "../config";

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
            void this.syncCatchAll();
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

        for (const platformUrl of platforms) {
            let host: string;
            let targetUrl: string;
            try {
                host = new URL(platformUrl).host;
                targetUrl = new URL("/api/webhook", platformUrl).toString();
            } catch {
                console.warn(`[seed] skipping invalid platform: ${platformUrl}`);
                continue;
            }

            const ename = `catchall:${host}`;
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
                await subRepo.save(
                    subRepo.create({
                        consumerId: consumer.id,
                        targetUrl,
                        ontologyFilter: [],
                        evaultFilter: [],
                        isCatchAll: true,
                        active: true,
                    }),
                );
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
                seeded += 1;
            }
        }

        console.log(
            `[seed] catch-all reconciliation done: ${seeded} changed of ${platforms.length} platforms`,
        );
        return { seeded, total: platforms.length };
    }
}
