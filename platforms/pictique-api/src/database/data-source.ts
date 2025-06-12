import "reflect-metadata";
import { DataSource } from "typeorm";
import { config } from "dotenv";
import { User } from "./entities/User";
import { Post } from "./entities/Post";
import { Comment } from "./entities/Comment";
import { Message } from "./entities/Message";
import path from "path";
import { Chat } from "./entities/Chat";
import { MessageReadStatus } from "./entities/MessageReadStatus";
import { PostgresSubscriber } from "../web3adapter/watchers/subscriber";

config({ path: path.resolve(__dirname, "../../../../.env") });

export const AppDataSource = new DataSource({
    type: "postgres",
    url: process.env.PICTIQUE_DATABASE_URL,
    synchronize: false,
    logging: process.env.NODE_ENV === "development",
    entities: [User, Post, Comment, Message, Chat, MessageReadStatus],
    migrations: ["src/database/migrations/*.ts"],
    subscribers: [PostgresSubscriber],
});
