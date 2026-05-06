import "reflect-metadata";
import cors from "cors";
import express from "express";
import { config } from "./config";
import { adminRouter } from "./controllers/AdminController";
import { applicationRouter } from "./controllers/ApplicationController";
import { authRouter } from "./controllers/AuthController";
import { consumerRouter } from "./controllers/ConsumerController";
import { ingestRouter } from "./controllers/IngestController";
import { queryRouter } from "./controllers/QueryController";
import { subscriptionRouter } from "./controllers/SubscriptionController";
import { AppDataSource } from "./database/data-source";
import { DeliveryEngine } from "./services/DeliveryEngine";

async function start(): Promise<void> {
    await AppDataSource.initialize();
    console.log("[aaas] database connected");

    const app = express();
    app.use(cors());
    app.use(express.json({ limit: "5mb" }));

    app.get("/health", (_req, res) => {
        res.json({ status: "ok", service: "awareness-service" });
    });

    app.use(ingestRouter());
    app.use(queryRouter());
    app.use(subscriptionRouter());
    app.use(consumerRouter());
    app.use(authRouter());
    app.use(applicationRouter());
    app.use(adminRouter());

    const deliveryEngine = new DeliveryEngine();
    deliveryEngine.start();

    app.listen(config.apiPort, () => {
        console.log(`[aaas] API listening on :${config.apiPort}`);
    });
}

start().catch((err) => {
    console.error("[aaas] failed to start:", err);
    process.exit(1);
});
