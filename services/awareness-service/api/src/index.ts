import "reflect-metadata";
import cors from "cors";
import express from "express";
import { config } from "./config";
import { ingestRouter } from "./controllers/IngestController";
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
