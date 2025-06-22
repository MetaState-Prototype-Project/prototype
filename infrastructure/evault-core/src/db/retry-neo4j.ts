import neo4j, { Driver } from "neo4j-driver";

/**
 * Attempts to connect to Neo4j with retry logic.
 * @param uri - Neo4j URI
 * @param user - Username
 * @param password - Password
 * @param maxRetries - Maximum number of retries (default: 10)
 * @param delayMs - Delay between retries in ms (default: 3000)
 * @returns Connected Neo4j Driver
 * @throws Error if connection fails after all retries
 */
export async function connectWithRetry(
    uri: string,
    user: string,
    password: string,
    maxRetries = 30,
    delayMs = 5000,
): Promise<Driver> {
    let attempt = 0;
    while (attempt < maxRetries) {
        try {
            const driver = neo4j.driver(
                uri,
                neo4j.auth.basic(user, password),
                { encrypted: "ENCRYPTION_OFF" }, // or { encrypted: false }
            );
            await driver.getServerInfo();
            console.log("Connected to Neo4j!");
            return driver;
        } catch (err: any) {
            attempt++;
            console.warn(
                `Neo4j connection attempt ${attempt} failed: ${err.message}. Retrying in ${delayMs}ms...`,
            );
            await new Promise((res) => setTimeout(res, delayMs));
        }
    }
    throw new Error("Could not connect to Neo4j after multiple attempts");
}
