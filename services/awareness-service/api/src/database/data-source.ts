import "reflect-metadata";
import path from "path";
import { DataSource } from "typeorm";
import { config } from "../config";
import { AccessApplication } from "./entities/AccessApplication";
import { ApiKey } from "./entities/ApiKey";
import { Consumer } from "./entities/Consumer";
import { DeadLetter } from "./entities/DeadLetter";
import { Delivery } from "./entities/Delivery";
import { Packet } from "./entities/Packet";
import { Subscription } from "./entities/Subscription";
import { AwarenessEvent } from "./entities/AwarenessEvent";
import { WorkerHeartbeat } from "./entities/WorkerHeartbeat";

export const AppDataSource = new DataSource({
    type: "postgres",
    url: config.databaseUrl,
    synchronize: false,
    logging: process.env.NODE_ENV === "development",
    entities: [
        Packet,
        Consumer,
        AccessApplication,
        ApiKey,
        Subscription,
        Delivery,
        DeadLetter,
        AwarenessEvent,
        WorkerHeartbeat,
    ],
    migrations: [path.join(__dirname, "migrations", "*.{ts,js}")],
    ssl: config.dbCaCert
        ? { rejectUnauthorized: false, ca: config.dbCaCert }
        : false,
    extra: {
        max: 10,
        min: 2,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000,
        statement_timeout: config.dbStatementTimeoutMs,
        query_timeout: config.dbQueryTimeoutMs,
        lock_timeout: config.dbLockTimeoutMs,
    },
});
