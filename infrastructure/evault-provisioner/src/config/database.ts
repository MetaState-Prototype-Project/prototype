import { DataSource } from "typeorm"
import { Verification } from "../entities/Verification"
import * as dotenv from "dotenv"
import { join } from "path"

// Load environment variables from root .env file
dotenv.config({ path: join(__dirname, "../../../../.env") })

export const AppDataSource = new DataSource({
    type: "postgres",
    url: process.env.PROVISIONER_DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/evault",
    logging: process.env.NODE_ENV !== "production",
    entities: [Verification],
    migrations: [join(__dirname, "../migrations/*.{ts,js}")],
    migrationsTableName: "migrations",
    subscribers: [],
}) 