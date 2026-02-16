import "reflect-metadata";
import path from "node:path";
import { config } from "dotenv";
import { DataSource, type DataSourceOptions } from "typeorm";
import { User } from "./entities/User";
import { Group } from "./entities/Group";
import { Reference } from "./entities/Reference";
import { Calculation } from "./entities/Calculation";
import { Vote } from "./entities/Vote";
import { Poll } from "./entities/Poll";
import { VoteReputationResult } from "./entities/VoteReputationResult";
import { Message } from "./entities/Message";
import { Wishlist } from "./entities/Wishlist";
import { ReferenceSignature } from "./entities/ReferenceSignature";
import { PostgresSubscriber } from "../web3adapter/watchers/subscriber";

// Use absolute path for better CLI compatibility
const envPath = path.resolve(__dirname, "../../../../.env");
config({ path: envPath });

export const dataSourceOptions: DataSourceOptions = {
    type: "postgres",
    url: process.env.EREPUTATION_DATABASE_URL,
    synchronize: false, // Auto-sync in development
        entities: [User, Group, Reference, Calculation, Vote, Poll, VoteReputationResult, Message, Wishlist, ReferenceSignature],
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