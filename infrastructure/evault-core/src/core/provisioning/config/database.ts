import { DataSource } from "typeorm";
import { Verification } from "../entities/Verification";
import * as dotenv from "dotenv";
import { join } from "path";

// Load environment variables from root .env file
dotenv.config({ path: join(__dirname, "../../../../.env") });

export const ProvisioningDataSource = new DataSource({
    type: "postgres",
    url: process.env.REGISTRY_DATABASE_URL || process.env.PROVISIONER_DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/registry",
    logging: process.env.DB_LOGGING === "true",
    entities: [Verification],
    synchronize: false,
    migrations: [],
    migrationsTableName: "migrations",
    subscribers: [],
});

