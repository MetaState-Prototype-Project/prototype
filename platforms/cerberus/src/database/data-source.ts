import { config } from "dotenv";
import { DataSource } from "typeorm";
import { User } from "./entities/User";
import { Group } from "./entities/Group";
import { Message } from "./entities/Message";
import { MetaEnvelopeMap } from "./entities/MetaEnvelopeMap";
import { PostgresSubscriber } from "../web3adapter/watchers/subscriber";
import path from "path";

config({ path: path.resolve(__dirname, "../../../../.env") });

export const AppDataSource = new DataSource({
    type: "postgres",
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    synchronize: false,
    logging: process.env.NODE_ENV === "development",
    entities: [User, Group, Message, MetaEnvelopeMap],
    migrations: ["src/database/migrations/*.ts"],
    subscribers: [PostgresSubscriber],
}); 