import "reflect-metadata";
import { DataSource } from "typeorm";
import { config } from "dotenv";
import path from "path";
import { User } from "./entities/User";
import { Session } from "./entities/Session";
import { PostgresSubscriber } from "../web3adapter/watchers/subscriber";

config({ path: path.resolve(__dirname, "../../../../.env") });

export const AppDataSource = new DataSource({
	type: "postgres",
	url: process.env.PROFILE_EDITOR_DATABASE_URL,
	synchronize: false,
	logging: process.env.NODE_ENV === "development",
	entities: [User, Session],
	migrations: [path.join(__dirname, "migrations", "*.ts")],
	subscribers: [PostgresSubscriber],
	ssl: process.env.DB_CA_CERT
		? {
				rejectUnauthorized: false,
				ca: process.env.DB_CA_CERT,
			}
		: false,
	extra: {
		max: 10,
		min: 2,
		idleTimeoutMillis: 30000,
		connectionTimeoutMillis: 5000,
		statement_timeout: 10000,
	},
});
