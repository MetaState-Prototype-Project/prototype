import "reflect-metadata";
import path from "node:path";
import { config } from "dotenv";
import { DataSource, type DataSourceOptions } from "typeorm";
import { Migration } from "./entities/Migration";
import { User } from "./entities/User";

config({ path: path.resolve(__dirname, "../../../../.env") });

export const dataSourceOptions: DataSourceOptions = {
    type: "postgres",
    url: process.env.EMOVER_DATABASE_URL,
    synchronize: false,
    entities: [User, Migration],
    migrations: [path.join(__dirname, "migrations", "*.ts")],
    logging: process.env.NODE_ENV === "development",
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
};

export const AppDataSource = new DataSource(dataSourceOptions);
