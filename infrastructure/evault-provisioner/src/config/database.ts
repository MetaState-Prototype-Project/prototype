import { DataSource } from "typeorm"
import { Verification } from "../entities/Verification"
import { Notification } from "../entities/Notification"
import * as dotenv from "dotenv"
import { join } from "path"

// Load environment variables from root .env file
dotenv.config({ path: join(__dirname, "../../../../.env") })

export const AppDataSource = new DataSource({
    type: "postgres",
    url: process.env.PROVISIONER_DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/provisioner",
    logging: process.env.NODE_ENV !== "production",
    entities: [Verification, Notification],
    migrations: [join(__dirname, "../migrations/*.{ts,js}")],
    migrationsTableName: "migrations",
    subscribers: [],
}) 