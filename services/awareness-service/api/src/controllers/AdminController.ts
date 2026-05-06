import { Router } from "express";
import { AppDataSource } from "../database/data-source";
import { AccessApplication } from "../database/entities/AccessApplication";
import { Consumer } from "../database/entities/Consumer";
import { DeadLetter } from "../database/entities/DeadLetter";
import { Delivery } from "../database/entities/Delivery";
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
        const deadLetters = await AppDataSource.getRepository(
            DeadLetter,
        ).find({
            where: includeResolved ? {} : { resolved: false },
            order: { createdAt: "DESC" },
            take: 200,
        });
        res.json({ deadLetters });
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
