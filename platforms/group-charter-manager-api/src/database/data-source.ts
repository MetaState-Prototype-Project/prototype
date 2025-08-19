import "reflect-metadata";
import { DataSource } from "typeorm";
import { config } from "dotenv";
import { User } from "./entities/User";
import { Group } from "./entities/Group";
import { Message } from "./entities/Message";
import { PostgresSubscriber } from "../web3adapter/watchers/subscriber";
import path from "path";
import { CharterSignature } from "./entities/CharterSignature";

config({ path: path.resolve(__dirname, "../../../../.env") });

export const AppDataSource = new DataSource({
    type: "postgres",
    url: process.env.GROUP_CHARTER_DATABASE_URL,
    synchronize: false,
    logging: process.env.NODE_ENV === "development",
    entities: [User, Group, Message, CharterSignature],
    migrations: ["src/database/migrations/*.ts"],
    subscribers: [PostgresSubscriber],
}); 