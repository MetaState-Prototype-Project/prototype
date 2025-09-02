import { DataSource } from "typeorm";
import { Session, User, ReputationCalculation, Reference, FileUpload } from "@shared/entities";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set. Did you forget to provision a database?");
}

export const AppDataSource = new DataSource({
  type: "postgres",
  url: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
  entities: [Session, User, ReputationCalculation, Reference, FileUpload],
  synchronize: process.env.NODE_ENV === "development", // Only in development
  logging: process.env.NODE_ENV === "development",
  migrations: ["server/migrations/*.ts"],
  migrationsTableName: "typeorm_migrations",
});