import "reflect-metadata";
import { DataSource } from "typeorm";
import { config } from "dotenv";
import { User } from "./entities/User";
import { Group } from "./entities/Group";
import { File } from "./entities/File";
import { Folder } from "./entities/Folder";
import { SignatureContainer } from "./entities/SignatureContainer";
import { Message } from "./entities/Message";
import { UserEVaultMapping } from "./entities/UserEVaultMapping";
import { FileAccess } from "./entities/FileAccess";
import { FolderAccess } from "./entities/FolderAccess";
import { Tag } from "./entities/Tag";
import path from "path";
import { PostgresSubscriber } from "../web3adapter/watchers/subscriber";

config({ path: path.resolve(__dirname, "../../../../.env") });

export const AppDataSource = new DataSource({
    type: "postgres",
    url: process.env.FILE_MANAGER_DATABASE_URL,
    synchronize: false,
    logging: process.env.NODE_ENV === "development",
    entities: [
        User,
        Group,
        File,
        Folder,
        SignatureContainer,
        Message,
        UserEVaultMapping,
        FileAccess,
        FolderAccess,
        Tag,
    ],
    migrations: [path.join(__dirname, "migrations", "*.ts")],
    subscribers: [PostgresSubscriber],
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
});

