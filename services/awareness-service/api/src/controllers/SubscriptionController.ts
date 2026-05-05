import { Router } from "express";
import { AppDataSource } from "../database/data-source";
import { Subscription } from "../database/entities/Subscription";
import { consumerAuth } from "../middleware/consumerAuth";

/**
 * /api/subscriptions - lets an approved consumer dynamically register webhook
 * subscriptions filtered by ontology and eVault. All routes are scoped to the
 * authenticated consumer.
 */
export function subscriptionRouter(): Router {
    const router = Router();
    router.use("/api/subscriptions", consumerAuth);

    const repo = () => AppDataSource.getRepository(Subscription);

    function normaliseTarget(
        targetUrl: unknown,
        webhookBaseUrl: string | null,
    ): string | null {
        if (typeof targetUrl === "string" && targetUrl.trim()) {
            return targetUrl.trim();
        }
        if (webhookBaseUrl) {
            return new URL("/api/webhook", webhookBaseUrl).toString();
        }
        return null;
    }

    function toStringArray(value: unknown): string[] {
        if (!Array.isArray(value)) return [];
        return value.filter((v): v is string => typeof v === "string");
    }

    router.get("/api/subscriptions", async (req, res) => {
        const subs = await repo().find({
            where: { consumerId: req.consumer!.id },
            order: { createdAt: "DESC" },
        });
        res.json({ subscriptions: subs });
    });

    router.post("/api/subscriptions", async (req, res) => {
        const targetUrl = normaliseTarget(
            req.body?.targetUrl,
            req.consumer!.webhookBaseUrl,
        );
        if (!targetUrl) {
            return res.status(400).json({
                error: "targetUrl is required (no webhookBaseUrl on consumer)",
            });
        }

        const sub = repo().create({
            consumerId: req.consumer!.id,
            targetUrl,
            ontologyFilter: toStringArray(req.body?.ontologyFilter),
            evaultFilter: toStringArray(req.body?.evaultFilter),
            secret:
                typeof req.body?.secret === "string"
                    ? req.body.secret
                    : null,
            isCatchAll: false,
            active: true,
        });
        await repo().save(sub);
        res.status(201).json({ subscription: sub });
    });

    router.patch("/api/subscriptions/:id", async (req, res) => {
        const sub = await repo().findOne({
            where: { id: req.params.id, consumerId: req.consumer!.id },
        });
        if (!sub) return res.status(404).json({ error: "not found" });

        if (req.body?.targetUrl !== undefined) {
            const t = normaliseTarget(
                req.body.targetUrl,
                req.consumer!.webhookBaseUrl,
            );
            if (t) sub.targetUrl = t;
        }
        if (req.body?.ontologyFilter !== undefined) {
            sub.ontologyFilter = toStringArray(req.body.ontologyFilter);
        }
        if (req.body?.evaultFilter !== undefined) {
            sub.evaultFilter = toStringArray(req.body.evaultFilter);
        }
        if (typeof req.body?.active === "boolean") {
            sub.active = req.body.active;
        }
        if (req.body?.secret !== undefined) {
            sub.secret =
                typeof req.body.secret === "string"
                    ? req.body.secret
                    : null;
        }
        await repo().save(sub);
        res.json({ subscription: sub });
    });

    router.delete("/api/subscriptions/:id", async (req, res) => {
        const result = await repo().update(
            { id: req.params.id, consumerId: req.consumer!.id },
            { active: false },
        );
        if (!result.affected) {
            return res.status(404).json({ error: "not found" });
        }
        res.json({ ok: true });
    });

    return router;
}
