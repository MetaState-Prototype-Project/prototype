import "reflect-metadata";
import path from "node:path";
import { config } from "dotenv";
import { DataSource, type DataSourceOptions } from "typeorm";
import { User } from "./entities/User";
import { Group } from "./entities/Group";
import { Message } from "./entities/Message";
import { Wishlist } from "./entities/Wishlist";
import { Match } from "./entities/Match";
import { UserEVaultMapping } from "./entities/UserEVaultMapping";
import { PostgresSubscriber } from "../web3adapter/watchers/subscriber";

// Use absolute path for better CLI compatibility
const envPath = path.resolve(__dirname, "../../../../.env");
config({ path: envPath });


export const dataSourceOptions: DataSourceOptions = {
    type: "postgres",
    url: process.env.DREAMSYNC_DATABASE_URL,
    synchronize: false, // Auto-sync in development
    entities: [User, Group, Message, Wishlist, Match, UserEVaultMapping],
    migrations: [path.join(__dirname, "migrations", "*.ts")],
    logging: process.env.NODE_ENV === "development",
    subscribers: [PostgresSubscriber],
};

export const AppDataSource = new DataSource(dataSourceOptions);
