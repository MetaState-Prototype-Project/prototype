// import "reflect-metadata";
import path from "node:path";
import { config } from "dotenv";
import { DataSource, type DataSourceOptions } from "typeorm";
import { Account } from "./entities/Account";
import { Session } from "./entities/Session";
import { User } from "./entities/User";
import { Verification } from "./entities/Verification";
// import { PostgresSubscriber } from "../web3adapter/watchers/subscriber";

config({ path: path.resolve(__dirname, "../../../../.env") });

export const dataSourceOptions: DataSourceOptions = {
    type: "postgres",
    url: process.env.EVOTING_DATABASE_URL,
    synchronize: false,
    entities: [User, Session, Account, Verification],
    migrations: ["src/database/migrations/*.ts"],
    // logging: process.env.NODE_ENV === "development",
    // subscribers: [PostgresSubscriber],
};

console.log(dataSourceOptions);

export const AppDataSource = new DataSource(dataSourceOptions);
