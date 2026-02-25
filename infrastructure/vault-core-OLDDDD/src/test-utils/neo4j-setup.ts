import neo4j, { Driver } from "neo4j-driver";
import { Neo4jContainer, StartedNeo4jContainer } from "@testcontainers/neo4j";

let container: StartedNeo4jContainer | null = null;
let driver: Driver | null = null;

export async function setupTestNeo4j(): Promise<{ container: StartedNeo4jContainer; driver: Driver }> {
    if (container && driver) {
        return { container, driver };
    }

    container = await new Neo4jContainer("neo4j:5.15").start();

    const username = container.getUsername();
    const password = container.getPassword();
    const boltPort = container.getMappedPort(7687);
    const uri = `bolt://localhost:${boltPort}`;

    driver = neo4j.driver(uri, neo4j.auth.basic(username, password));

    return { container, driver };
}

export async function teardownTestNeo4j(): Promise<void> {
    if (driver) {
        await driver.close();
        driver = null;
    }
    if (container) {
        await container.stop();
        container = null;
    }
}

