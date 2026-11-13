import { DataSource } from "typeorm";
import { ClientEntity, ClientEventEntity } from "./entities.js";
import { Init1790600000000 } from "./migrations/1790600000000-Init.js";
import { ClientLogo1790700000000 } from "./migrations/1790700000000-ClientLogo.js";

export function createDataSource(options: {
    url: string;
    caCert?: string;
}): DataSource {
    return new DataSource({
        type: "postgres",
        url: options.url,
        synchronize: false,
        logging: false,
        entities: [ClientEntity, ClientEventEntity],
        migrations: [Init1790600000000, ClientLogo1790700000000],
        migrationsTransactionMode: "each",
        ssl: options.caCert
            ? { rejectUnauthorized: false, ca: options.caCert }
            : false,
        extra: { max: 10, connectionTimeoutMillis: 5000 },
    });
}
