import { DataSource } from "typeorm"
import { Vault } from "../entities/Vault"
import * as dotenv from "dotenv"
import { join } from "path"

// Load environment variables from root .env file
dotenv.config({ path: join(__dirname, "../../../../.env") })

export const AppDataSource = new DataSource({
    type: "postgres",
    url: process.env.REGISTRY_DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/registry",
    synchronize: process.env.NODE_ENV !== "production",
    logging: process.env.NODE_ENV !== "production",
    entities: [Vault],
    migrations: [join(__dirname, "../migrations/*.{ts,js}")],
    migrationsTableName: "migrations",
    subscribers: [],
}) 