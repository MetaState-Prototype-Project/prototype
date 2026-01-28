import "reflect-metadata";
import path from "node:path";
import { config } from "dotenv";
import { DataSource, type DataSourceOptions } from "typeorm";
import { User } from "./entities/User";
import { Group } from "./entities/Group";
import { Verification } from "./entities/Verification";
import { Poll } from "./entities/Poll";
import { Vote } from "./entities/Vote";
import { PollVotingState } from "./entities/PollVotingState";
import { MetaEnvelopeMap } from "./entities/MetaEnvelopeMap";
import { Message } from "./entities/Message";
import { VoteReputationResult } from "./entities/VoteReputationResult";
import { PostgresSubscriber } from "../web3adapter/watchers/subscriber";

config({ path: path.resolve(__dirname, "../../../../.env") });

export const dataSourceOptions: DataSourceOptions = {
    type: "postgres",
    url: process.env.EVOTING_DATABASE_URL,
    synchronize: false,
    entities: [User, Group, Verification, Poll, Vote, PollVotingState, MetaEnvelopeMap, Message, VoteReputationResult],
    migrations: [path.join(__dirname, "migrations", "*.ts")],
    logging: process.env.NODE_ENV === "development",
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
};

export const AppDataSource = new DataSource(dataSourceOptions);
