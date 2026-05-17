import axios from "axios";
import { AppDataSource } from "../database/data-source";
import { Consumer } from "../database/entities/Consumer";
import { Subscription } from "../database/entities/Subscription";
import { config } from "../config";

/**
 * Backward-compat seeding. Before AaaS, evault-core fanned out every webhook to
 * every registered platform. To preserve that behaviour, on launch we ensure
 * each platform currently in the registry has an approved consumer and a
 * catch-all subscription (empty filters) pointing at `<platform>/api/webhook`.
 *
 * Idempotent: existing catch-all subscriptions are left untouched.
 */
export class SeedService {
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
            }
        }

        console.log(
            `[seed] catch-all seeding done: ${seeded} new of ${platforms.length} platforms`,
        );
        return { seeded, total: platforms.length };
    }
}
