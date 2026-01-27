import { config } from "dotenv";
import { DataSource } from "typeorm";
import { User } from "./entities/User";
import { Group } from "./entities/Group";
import { Message } from "./entities/Message";
import { MetaEnvelopeMap } from "./entities/MetaEnvelopeMap";
import { PostgresSubscriber } from "../web3adapter/watchers/subscriber";
import path from "path";
import { UserEVaultMapping } from "./entities/UserEVaultMapping";
import { VotingObservation } from "./entities/VotingObservation";
import { CharterSignature } from "./entities/CharterSignature";

config({ path: path.resolve(__dirname, "../../../../.env") });

export const AppDataSource = new DataSource({
    type: "postgres",
    url: process.env.CERBERUS_DATABASE_URL,
    synchronize: true, // Temporarily enabled to create voting_observations table
    logging: process.env.NODE_ENV === "development",
    entities: [
        User,
        Group,
        Message,
        MetaEnvelopeMap,
        UserEVaultMapping,
        VotingObservation,
        CharterSignature,
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
        // Maximum number of connections in pool
        max: 20,
        // Minimum number of connections in pool
        min: 2,
        // Maximum time (ms) a connection can be idle before being released
        idleTimeoutMillis: 30000,
        // Maximum time (ms) to wait for a connection from pool
        connectionTimeoutMillis: 5000,
        // Query timeout (ms) - fail queries that take too long
        statement_timeout: 10000,
    },
});

