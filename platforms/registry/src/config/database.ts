import { DataSource } from "typeorm"
import { Vault } from "../entities/Vault"
// Import Verification entity from evault-core if available (shared database)
import * as dotenv from "dotenv"
import { join } from "path"

// Load environment variables from root .env file
dotenv.config({ path: join(__dirname, "../../../../.env") })

export const AppDataSource = new DataSource({
    type: "postgres",
    url: process.env.REGISTRY_DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/registry",
    synchronize: false,
    logging: process.env.DB_LOGGING === "true",
    entities: [Vault],
    // Verification entity will be handled by evault-core provisioning service
    migrations: [join(__dirname, "../migrations/*.{ts,js}")],
    migrationsTableName: "migrations",
    subscribers: [],
    ssl: process.env.DB_CA_CERT
        ? {
              rejectUnauthorized: false,
              ca: process.env.DB_CA_CERT,
          }
        : false,
}) 