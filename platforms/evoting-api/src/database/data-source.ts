import "reflect-metadata";
import path from "node:path";
import { config } from "dotenv";
import { DataSource, type DataSourceOptions } from "typeorm";
import { User } from "./entities/User";
import { Verification } from "./entities/Verification";
import { Poll } from "./entities/Poll";
import { Vote } from "./entities/Vote";
import { MetaEnvelopeMap } from "./entities/MetaEnvelopeMap";

config({ path: path.resolve(__dirname, "../../../../.env") });

export const dataSourceOptions: DataSourceOptions = {
    type: "postgres",
    url: process.env.EVOTING_DATABASE_URL,
    synchronize: false,
    entities: [User, Verification, Poll, Vote, MetaEnvelopeMap],
    migrations: [path.join(__dirname, "migrations", "*.ts")],
    logging: process.env.NODE_ENV === "development",
};

export const AppDataSource = new DataSource(dataSourceOptions);
