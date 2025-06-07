import "reflect-metadata";
import { DataSource } from "typeorm";
import { config } from "dotenv";
import { User } from "./entities/User";
import path from "path";
import { Chat } from "./entities/Chat";
import { MessageReadStatus } from "./entities/MessageReadStatus";
import { Blab } from "./entities/Blab";
import { Reply } from "./entities/Reply";
import { Text } from "./entities/Text";

config({ path: path.resolve(__dirname, "../../../../.env") });

export const AppDataSource = new DataSource({
    type: "postgres",
    url: process.env.BLABSY_DATABASE_URL,
    synchronize: false,
    logging: process.env.NODE_ENV === "development",
    entities: [User, Blab, Reply, Text, Chat, MessageReadStatus],
    migrations: ["src/database/migrations/*.ts"],
    subscribers: [],
});
