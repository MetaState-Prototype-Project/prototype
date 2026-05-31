import "reflect-metadata";
import path from "node:path";
import { DataSource } from "typeorm";
import { ProfessionalProfile } from "./entities/ProfessionalProfile";
import { User } from "./entities/User";
import { env } from "./env";
import { PostgresSubscriber } from "./web3adapter/watchers/subscriber";

export const AppDataSource = new DataSource({
    type: "postgres",
    url: env.databaseUrl,
    synchronize: false,
    logging: env.nodeEnv === "development",
    entities: [User, ProfessionalProfile],
    migrations: [path.join(__dirname, "migrations", "*.{ts,js}")],
    subscribers: [PostgresSubscriber],
    ssl: env.dbCaCert ? { rejectUnauthorized: false, ca: env.dbCaCert } : false,
    extra: {
        max: 10,
        min: 2,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000,
        statement_timeout: 10000,
    },
});
