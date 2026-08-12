import { Router } from "express";
import { AppDataSource } from "../database/data-source";
import { ApiKey } from "../database/entities/ApiKey";
import { Delivery } from "../database/entities/Delivery";
import { Subscription } from "../database/entities/Subscription";
import { consumerAuth } from "../middleware/consumerAuth";
import { ApiKeyService } from "../services/ApiKeyService";

/**
 * /api/me - consumer self-service: profile, API key rotation, and recent
 * delivery status. All routes require a valid consumer API key.
 */
export function consumerRouter(): Router {
    const router = Router();
    const apiKeyService = new ApiKeyService();
    router.use("/api/me", consumerAuth);

    router.get("/api/me", (req, res) => {
        const c = req.consumer!;
        res.json({
            id: c.id,
            ename: c.ename,
            name: c.name,
            status: c.status,
            webhookBaseUrl: c.webhookBaseUrl,
        });
    });

    router.get("/api/me/api-keys", async (req, res) => {
        const keys = await AppDataSource.getRepository(ApiKey).find({
            where: { consumerId: req.consumer!.id },
            order: { createdAt: "DESC" },
        });
        res.json({
            apiKeys: keys.map((k) => ({
                id: k.id,
                keyPrefix: k.keyPrefix,
                revoked: k.revoked,
                createdAt: k.createdAt,
                lastUsedAt: k.lastUsedAt,
            })),
        });
    });

    // Rotate / add a key. The plaintext is returned exactly once here.
    router.post("/api/me/api-keys", async (req, res) => {
        const { plaintext, apiKey } = await apiKeyService.issue(
            req.consumer!.id,
        );
        res.status(201).json({
            id: apiKey.id,
            keyPrefix: apiKey.keyPrefix,
            apiKey: plaintext,
        });
    });

    router.delete("/api/me/api-keys/:id", async (req, res) => {
        const ok = await apiKeyService.revoke(
            req.params.id,
            req.consumer!.id,
        );
        if (!ok) return res.status(404).json({ error: "not found" });
        res.json({ ok: true });
    });

    // Recent delivery outcomes across this consumer's subscriptions.
    router.get("/api/me/deliveries", async (req, res) => {
        const limit = Math.min(
            parseInt(String(req.query.limit ?? "50"), 10) || 50,
            200,
        );
        const deliveries = await AppDataSource.getRepository(Delivery)
            .createQueryBuilder("d")
            // The `payload` snapshot is deliberately excluded: it is a full
            // event body per row and nothing here renders it, so selecting it
            // would drag every matched row's jsonb out of TOAST for nothing.
            .select([
                "d.id",
                "d.subscriptionId",
                "d.packetId",
                "d.status",
                "d.attempts",
                "d.nextAttemptAt",
                "d.lastError",
                "d.lastResponseStatus",
                "d.createdAt",
                "d.deliveredAt",
            ])
            .innerJoin(
                Subscription,
                "s",
                "s.id = d.subscriptionId AND s.consumerId = :cid",
                { cid: req.consumer!.id },
            )
            .orderBy("d.createdAt", "DESC")
            // `limit`, not `take`: with a join present `take` makes TypeORM
            // wrap the query in a SELECT DISTINCT over an *unbounded* subquery
            // and apply LIMIT only on the outside, so Postgres materialises and
            // sorts the consumer's entire delivery history to return 50 rows.
            // The join is to subscriptions on its primary key and so cannot
            // duplicate rows, which is the only thing that DISTINCT pass buys.
            .limit(limit)
            .getMany();
        res.json({ deliveries });
    });

    return router;
}
