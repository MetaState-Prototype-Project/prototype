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
    migrations: ["src/database/migrations/*.ts"],
    subscribers: [PostgresSubscriber],
});

