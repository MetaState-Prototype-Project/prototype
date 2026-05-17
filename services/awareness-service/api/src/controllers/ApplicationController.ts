import { Router } from "express";
import { AppDataSource } from "../database/data-source";
import { AccessApplication } from "../database/entities/AccessApplication";
import { Consumer } from "../database/entities/Consumer";
import { portalAuth } from "../middleware/portalAuth";

/**
 * /api/applications - a logged-in platform applies for awareness access and
 * checks the status of its own application.
 */
export function applicationRouter(): Router {
    const router = Router();
    router.use("/api/applications", portalAuth);

    router.get("/api/applications/me", async (req, res) => {
        const consumer = await AppDataSource.getRepository(Consumer).findOne({
            where: { ename: req.ename! },
        });
        if (!consumer) return res.json({ consumer: null, application: null });

        const application = await AppDataSource.getRepository(
            AccessApplication,
        ).findOne({
            where: { consumerId: consumer.id },
            order: { createdAt: "DESC" },
        });
        res.json({ consumer, application });
    });

    router.post("/api/applications", async (req, res) => {
        const consumerRepo = AppDataSource.getRepository(Consumer);
        const appRepo = AppDataSource.getRepository(AccessApplication);

        let consumer = await consumerRepo.findOne({
            where: { ename: req.ename! },
        });

        if (consumer && consumer.status === "approved") {
            return res
                .status(409)
                .json({ error: "consumer is already approved" });
        }

        // An application is just: name, website URL and description.
        const { name, websiteUrl, description } = req.body ?? {};
        if (!name || !websiteUrl || !description) {
            return res.status(400).json({
                error: "name, websiteUrl and description are required",
            });
        }

        if (!consumer) {
            consumer = consumerRepo.create({
                ename: req.ename!,
                status: "pending",
            });
        }
        consumer.name = name;
        consumer.webhookBaseUrl = websiteUrl;
        consumer.status = "pending";
        await consumerRepo.save(consumer);

        // Reuse an existing pending application rather than stacking duplicates.
        let application = await appRepo.findOne({
            where: { consumerId: consumer.id, status: "pending" },
        });
        if (!application) {
            application = appRepo.create({ consumerId: consumer.id });
        }
        application.justification = description;
        application.requestedOntologies = [];
        application.status = "pending";
        await appRepo.save(application);

        res.status(201).json({ consumer, application });
    });

    return router;
}
