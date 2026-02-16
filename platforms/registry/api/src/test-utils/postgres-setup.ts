import { DataSource } from "typeorm";
import { PostgreSqlContainer, StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { Vault } from "../entities/Vault";

let container: StartedPostgreSqlContainer | null = null;
let dataSource: DataSource | null = null;

export async function setupTestDatabase(): Promise<{ container: StartedPostgreSqlContainer; dataSource: DataSource }> {
    if (container && dataSource?.isInitialized) {
        return { container, dataSource };
    }

    container = await new PostgreSqlContainer("postgres:15-alpine")
        .withDatabase("test_registry")
        .withUsername("test")
        .withPassword("test")
        .start();

    const connectionUrl = container.getConnectionUri();

    dataSource = new DataSource({
        type: "postgres",
        url: connectionUrl,
        synchronize: true,
        logging: false,
        entities: [Vault],
    });

    await dataSource.initialize();

    return { container, dataSource };
}

export async function teardownTestDatabase(): Promise<void> {
    if (dataSource?.isInitialized) {
        await dataSource.destroy();
        dataSource = null;
    }
    if (container) {
        await container.stop();
        container = null;
    }
}

