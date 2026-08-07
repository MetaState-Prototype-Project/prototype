import { Router } from "express";
import { AppDataSource } from "../database/data-source";
import { AccessApplication } from "../database/entities/AccessApplication";
import { Consumer } from "../database/entities/Consumer";
import { DeadLetter } from "../database/entities/DeadLetter";
import { Delivery } from "../database/entities/Delivery";
import { Packet } from "../database/entities/Packet";
import { Subscription } from "../database/entities/Subscription";
import { adminAuth } from "../middleware/portalAuth";

/**
 * /api/admin - whitelisted admins review access applications and inspect /
 * replay dead-lettered webhook deliveries.
 */
export function adminRouter(): Router {
    const router = Router();
    router.use("/api/admin", adminAuth);

    // Pending (or all) access applications with their consumer details.
    router.get("/api/admin/applications", async (req, res) => {
        const status = (req.query.status as string) ?? "pending";
        const apps = await AppDataSource.getRepository(AccessApplication)
            .createQueryBuilder("a")
            .innerJoinAndMapOne(
                "a.consumer",
                Consumer,
                "c",
                "c.id = a.consumerId",
            )
            .where(status === "all" ? "1=1" : "a.status = :status", {
                status,
            })
            .orderBy("a.createdAt", "DESC")
            .getMany();
        res.json({ applications: apps });
    });

    // Inspect effective targets without exposing webhook signing secrets.
    router.get("/api/admin/subscriptions", async (req, res) => {
        const target =
            typeof req.query.target === "string" ? req.query.target : null;
        const qb = AppDataSource.getRepository(Subscription)
            .createQueryBuilder("s")
            .innerJoin(Consumer, "c", "c.id = s.consumerId")
            .select([
                's.id AS "subscriptionId"',
                's.targetUrl AS "targetUrl"',
                's.isCatchAll AS "isCatchAll"',
                's.active AS "active"',
                's.ontologyFilter AS "ontologyFilter"',
                's.evaultFilter AS "evaultFilter"',
                's.createdAt AS "createdAt"',
                'c.id AS "consumerId"',
                'c.ename AS "consumerEname"',
                'c.status AS "consumerStatus"',
                'c.webhookBaseUrl AS "webhookBaseUrl"',
            ])
            .orderBy("s.createdAt", "ASC");
        if (target) {
            qb.where("s.targetUrl ILIKE :target", { target: `%${target}%` });
        }
        const subscriptions = await qb.getRawMany();
        res.json({ count: subscriptions.length, subscriptions });
    });

    router.post("/api/admin/applications/:id/approve", async (req, res) => {
        const appRepo = AppDataSource.getRepository(AccessApplication);
        const application = await appRepo.findOne({
            where: { id: req.params.id },
        });
        if (!application) return res.status(404).json({ error: "not found" });

        application.status = "approved";
        application.reviewedByEname = req.ename!;
        application.reviewNote = req.body?.note ?? null;
        application.reviewedAt = new Date();
        await appRepo.save(application);

        await AppDataSource.getRepository(Consumer).update(
            application.consumerId,
            { status: "approved", approvedAt: new Date() },
        );
        res.json({ ok: true, application });
    });

    router.post("/api/admin/applications/:id/reject", async (req, res) => {
        const appRepo = AppDataSource.getRepository(AccessApplication);
        const application = await appRepo.findOne({
            where: { id: req.params.id },
        });
        if (!application) return res.status(404).json({ error: "not found" });

        application.status = "rejected";
        application.reviewedByEname = req.ename!;
        application.reviewNote = req.body?.note ?? null;
        application.reviewedAt = new Date();
        await appRepo.save(application);

        await AppDataSource.getRepository(Consumer).update(
            application.consumerId,
            { status: "rejected" },
        );
        res.json({ ok: true, application });
    });

    router.get("/api/admin/dead-letters", async (req, res) => {
        const includeResolved = req.query.resolved === "true";
        // Metadata only - the `payload` column holds the full webhook body and
        // would bloat the list. Fetch it on replay if ever needed.
        const deadLetters = await AppDataSource.getRepository(
            DeadLetter,
        ).find({
            select: [
                "id",
                "deliveryId",
                "subscriptionId",
                "packetId",
                "consumerId",
                "targetUrl",
                "totalAttempts",
                "lastError",
                "lastResponseStatus",
                "resolved",
                "createdAt",
            ],
            where: includeResolved ? {} : { resolved: false },
            order: { createdAt: "DESC" },
            take: 200,
        });
        res.json({ deadLetters });
    });

    // Definitive end-to-end trace for one awareness packet: every matched
    // subscription, resolved target, owning consumer and delivery outcome.
    router.get("/api/admin/packets/:id/deliveries", async (req, res) => {
        const rows = await AppDataSource.getRepository(Delivery)
            .createQueryBuilder("d")
            .innerJoin(Subscription, "s", "s.id = d.subscriptionId")
            .innerJoin(Consumer, "c", "c.id = s.consumerId")
            .select([
                'd.id AS "deliveryId"',
                'd.packetId AS "packetId"',
                'd.status AS "status"',
                'd.attempts AS "attempts"',
                'd.nextAttemptAt AS "nextAttemptAt"',
                'd.deliveredAt AS "deliveredAt"',
                'd.lastResponseStatus AS "lastResponseStatus"',
                'd.lastError AS "lastError"',
                's.id AS "subscriptionId"',
                's.targetUrl AS "targetUrl"',
                's.isCatchAll AS "isCatchAll"',
                's.active AS "subscriptionActive"',
                's.ontologyFilter AS "ontologyFilter"',
                's.evaultFilter AS "evaultFilter"',
                'c.id AS "consumerId"',
                'c.ename AS "consumerEname"',
                'c.status AS "consumerStatus"',
            ])
            .where("d.packetId = :packetId", { packetId: req.params.id })
            .orderBy("d.createdAt", "ASC")
            .getRawMany();

        const packetExists = await AppDataSource.getRepository(Packet).exists({
            where: { id: req.params.id },
        });

        res.json({
            packetId: req.params.id,
            packetExists,
            deliveryCount: rows.length,
            deliveries: rows,
        });
    });

    // Replay re-queues the original delivery and resolves the dead letter.
    router.post("/api/admin/dead-letters/:id/replay", async (req, res) => {
        const dlRepo = AppDataSource.getRepository(DeadLetter);
        const deadLetter = await dlRepo.findOne({
            where: { id: req.params.id },
        });
        if (!deadLetter) return res.status(404).json({ error: "not found" });

        await AppDataSource.getRepository(Delivery).update(
            deadLetter.deliveryId,
            {
                status: "pending",
                attempts: 0,
                nextAttemptAt: new Date(),
                lastError: null,
                lastResponseStatus: null,
            },
        );
        deadLetter.resolved = true;
        await dlRepo.save(deadLetter);
        res.json({ ok: true });
    });

    return router;
}
