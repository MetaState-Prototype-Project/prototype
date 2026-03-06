import { DataSource } from "typeorm"
import { Verification } from "../entities/Verification"
import { Notification } from "../entities/Notification"
import { DeviceToken } from "../entities/DeviceToken"
import * as dotenv from "dotenv"
import { join } from "path"

// Load environment variables from root .env file
dotenv.config({ path: join(__dirname, "../../../../.env") })

export const AppDataSource = new DataSource({
    type: "postgres",
    url: process.env.REGISTRY_DATABASE_URL || process.env.PROVISIONER_DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/registry",
    logging: process.env.NODE_ENV !== "production",
    entities: [Verification, Notification, DeviceToken],
    migrations: [join(__dirname, "../migrations/*.{ts,js}")],
    migrationsTableName: "migrations",
    subscribers: [],
    ssl: process.env.DB_CA_CERT
        ? {
              rejectUnauthorized: false,
              ca: process.env.DB_CA_CERT,
          }
        : false,
    // Connection pool configuration to prevent exhaustion
    extra: {
        max: 10,
        min: 2,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000,
        statement_timeout: 10000,
    },
}) 