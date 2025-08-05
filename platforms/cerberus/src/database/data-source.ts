import { config } from "dotenv";
import { DataSource } from "typeorm";
import { User } from "./entities/User";
import { Group } from "./entities/Group";
import { Message } from "./entities/Message";
import { MetaEnvelopeMap } from "./entities/MetaEnvelopeMap";
import { PostgresSubscriber } from "../web3adapter/watchers/subscriber";
import path from "path";
import { UserEVaultMapping } from "./entities/UserEVaultMapping";

config({ path: path.resolve(__dirname, "../../../../.env") });

export const AppDataSource = new DataSource({
    type: "postgres",
    url: process.env.CERBERUS_DATABASE_URL,
    synchronize: false,
    logging: process.env.NODE_ENV === "development",
    entities: [User, Group, Message, MetaEnvelopeMap, UserEVaultMapping],
    migrations: ["src/database/migrations/*.ts"],
    subscribers: [PostgresSubscriber],
}); 