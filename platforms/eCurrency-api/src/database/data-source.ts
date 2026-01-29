import "reflect-metadata";
import path from "path";
import { config } from "dotenv";
import { DataSource, type DataSourceOptions } from "typeorm";
import { User } from "./entities/User";
import { Group } from "./entities/Group";
import { Currency } from "./entities/Currency";
import { Ledger } from "./entities/Ledger";
import { Message } from "./entities/Message";
import { UserEVaultMapping } from "./entities/UserEVaultMapping";
import { PostgresSubscriber } from "../web3adapter/watchers/subscriber";

// Use absolute path for better CLI compatibility
const envPath = path.resolve(__dirname, "../../../../.env");
config({ path: envPath });

export const dataSourceOptions: DataSourceOptions = {
    type: "postgres",
    url: process.env.ECURRENCY_DATABASE_URL,
    synchronize: false, // Auto-sync in development
    entities: [User, Group, Currency, Ledger, Message, UserEVaultMapping],
    migrations: [path.join(__dirname, "migrations", "*.ts")],
    logging: process.env.NODE_ENV === "development",
    subscribers: [PostgresSubscriber],
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

