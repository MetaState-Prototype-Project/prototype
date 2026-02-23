import "reflect-metadata";
import { DataSource } from "typeorm";
import { FastifyInstance } from "fastify";
import type { AddressInfo } from "node:net";
import { createServer } from "node:net";
import { Driver } from "neo4j-driver";
import { setupTestNeo4j, teardownTestNeo4j } from "./neo4j-setup";
import { setupTestDatabase, teardownTestDatabase } from "./postgres-setup";
import { createMockRegistryServer, stopMockRegistryServer } from "./mock-registry-server";
import { VerificationService } from "../services/VerificationService";
import { ProvisioningService } from "../services/ProvisioningService";
import { Verification } from "../entities/Verification";
import { Notification } from "../entities/Notification";
import { DbService } from "../core/db/db.service";
import { GraphQLServer } from "../core/protocol/graphql-server";
import { registerHttpRoutes } from "../core/http/server";
import { connectWithRetry } from "../core/db/retry-neo4j";
import fastify, { FastifyRequest, FastifyReply } from "fastify";
import { createYoga } from "graphql-yoga";
import { renderVoyagerPage } from "graphql-voyager/middleware";
import axios from "axios";
import { v4 as uuidv4 } from "uuid";
import * as jose from "jose";
import { getSharedTestKeyPair } from "./shared-test-keys";

export interface E2ETestServer {
    fastifyServer: FastifyInstance;
    expressPort: number;
    fastifyPort: number;
    registryPort: number;
    neo4jDriver: Driver;
    postgresDataSource: DataSource;
    registryServer: FastifyInstance;
    dbService: DbService;
    provisioningService: ProvisioningService;
    testDataSource: DataSource;
}

export interface ProvisionedEVault {
    w3id: string;
    uri: string;
}

async function getAvailablePort(): Promise<number> {
    return await new Promise((resolve, reject) => {
        const server = createServer();
        server.listen(0, "127.0.0.1", () => {
            const address = server.address() as AddressInfo;
            const port = address.port;
            server.close((error) => {
                if (error) reject(error);
                else resolve(port);
            });
        });
        server.on("error", reject);
    });
}

/**
 * Sets up a complete E2E test environment with:
 * - Neo4j testcontainer
 * - PostgreSQL testcontainer
 * - Mock registry server
 * - evault-core Fastify server (GraphQL/HTTP)
 * - evault-core Express server (Provisioning API)
 */
export async function setupE2ETestServer(
    expressPort?: number,
    fastifyPort?: number,
    registryPort?: number,
): Promise<E2ETestServer> {
    const resolvedExpressPort = expressPort ?? (await getAvailablePort());
    const resolvedFastifyPort = fastifyPort ?? (await getAvailablePort());
    const resolvedRegistryPort = registryPort ?? (await getAvailablePort());

    // Setup testcontainers
    const { container: neo4jContainer, driver: neo4jDriver } = await setupTestNeo4j();
    const { container: postgresContainer, dataSource: postgresDataSource } = await setupTestDatabase();

    // Setup mock registry server
    const registryServer = await createMockRegistryServer(resolvedRegistryPort);
    const registryUrl = `http://localhost:${resolvedRegistryPort}`;

    // Set environment variables for evault-core
    const neo4jUri = `bolt://localhost:${neo4jContainer.getMappedPort(7687)}`;
    process.env.NEO4J_URI = neo4jUri;
    process.env.NEO4J_USER = neo4jContainer.getUsername();
    process.env.NEO4J_PASSWORD = neo4jContainer.getPassword();
    process.env.PUBLIC_REGISTRY_URL = registryUrl;
    process.env.REGISTRY_URL = registryUrl; // Also set REGISTRY_URL for vault-access-guard
    process.env.REGISTRY_SHARED_SECRET = "test-secret";
    process.env.PUBLIC_EVAULT_SERVER_URI = `http://localhost:${resolvedFastifyPort}`;
    process.env.EVAULT_BASE_URI = `http://localhost:${resolvedFastifyPort}`;
    process.env.EVAULT_HOST = "localhost";
    process.env.PORT = String(resolvedFastifyPort);
    process.env.FASTIFY_PORT = String(resolvedFastifyPort);
    process.env.EXPRESS_PORT = String(resolvedExpressPort);
    process.env.DEMO_CODE_W3DS = "d66b7138-538a-465f-a6ce-f6985854c3f4";

    // Initialize PostgreSQL DataSource (used by provisioning service)
    const connectionUrl = postgresContainer.getConnectionUri();
    const testDataSource = new DataSource({
        type: "postgres",
        url: connectionUrl,
        synchronize: true,
        logging: false,
        entities: [Verification, Notification],
    });
    await testDataSource.initialize();

    // Initialize Neo4j connection
    const driver = await connectWithRetry(
        neo4jUri,
        neo4jContainer.getUsername(),
        neo4jContainer.getPassword()
    );

    // Create eName index
    try {
        const { createENameIndex } = await import("../core/db/migrations/add-ename-index");
        await createENameIndex(driver);
    } catch (error) {
        console.warn("Failed to create eName index:", error);
    }

    // Create EnvelopeOperationLog indexes for /logs endpoint
    try {
        const { createEnvelopeOperationLogIndexes } = await import("../core/db/migrations/add-envelope-operation-log-index");
        await createEnvelopeOperationLogIndexes(driver);
    } catch (error) {
        console.warn("Failed to create EnvelopeOperationLog indexes:", error);
    }

    // Initialize services
    const verificationService = new VerificationService(
        testDataSource.getRepository(Verification)
    );
    const provisioningService = new ProvisioningService(verificationService);
    const dbService = new DbService(driver);

    // Create evault instance
    const evaultInstance = {
        publicKey: null,
        w3id: null,
    };

    // Setup GraphQL server
    const graphqlServer = new GraphQLServer(dbService, null, null, evaultInstance);
    const yoga = graphqlServer.init();

    // Setup Fastify server
    const fastifyServer = fastify({
        logger: false,
        bodyLimit: 20 * 1024 * 1024, // 20MB, match production limit
    });
    await registerHttpRoutes(fastifyServer, evaultInstance, provisioningService, dbService);

    // Register GraphQL endpoint
    fastifyServer.route({
        url: yoga.graphqlEndpoint,
        method: ["GET", "POST", "OPTIONS"],
        handler: (req, reply) => yoga.handleNodeRequestAndResponse(req, reply),
    });

    // Mount Voyager endpoint
    fastifyServer.get("/voyager", (req: FastifyRequest, reply: FastifyReply) => {
        reply.type("text/html").send(
            renderVoyagerPage({
                endpointUrl: "/graphql",
            })
        );
    });

    // Start Fastify server
    await fastifyServer.listen({ port: resolvedFastifyPort, host: "0.0.0.0" });

    return {
        fastifyServer,
        expressPort: resolvedExpressPort,
        fastifyPort: resolvedFastifyPort,
        registryPort: resolvedRegistryPort,
        neo4jDriver: driver,
        postgresDataSource,
        registryServer,
        dbService,
        provisioningService,
        testDataSource,
    };
}

/**
 * Tears down the E2E test environment
 */
export async function teardownE2ETestServer(server: E2ETestServer | undefined): Promise<void> {
    if (!server) {
        return;
    }

    try {
        await server.fastifyServer.close();
    } catch (error) {
        console.error("Error closing Fastify server:", error);
    }

    // Close Neo4j DB service and driver before stopping containers
    if (server.dbService) {
        try {
            await server.dbService.close();
        } catch (error) {
            console.error("Error closing DbService:", error);
        }
    }

    // Also close the raw Neo4j driver if available
    if (server.neo4jDriver) {
        try {
            await server.neo4jDriver.close();
        } catch (error) {
            console.error("Error closing Neo4j driver:", error);
        }
    }

    // Destroy PostgreSQL testDataSource
    if (server.testDataSource?.isInitialized) {
        try {
            await server.testDataSource.destroy();
        } catch (error) {
            console.error("Error destroying testDataSource:", error);
        }
    }

    // Stop registry server
    if (server.registryServer) {
        try {
            await stopMockRegistryServer(server.registryServer);
        } catch (error) {
            console.error("Error stopping registry server:", error);
        }
    }
    
    // Stop testcontainers
    try {
        await teardownTestNeo4j();
    } catch (error) {
        console.error("Error tearing down Neo4j testcontainer:", error);
    }

    try {
        await teardownTestDatabase();
    } catch (error) {
        console.error("Error tearing down PostgreSQL testcontainer:", error);
    }

    // Clean up environment variables
    delete process.env.NEO4J_URI;
    delete process.env.NEO4J_USER;
    delete process.env.NEO4J_PASSWORD;
    delete process.env.PUBLIC_REGISTRY_URL;
    delete process.env.REGISTRY_URL;
    delete process.env.REGISTRY_SHARED_SECRET;
    delete process.env.PUBLIC_EVAULT_SERVER_URI;
    delete process.env.EVAULT_BASE_URI;
    delete process.env.EVAULT_HOST;
    delete process.env.PORT;
    delete process.env.FASTIFY_PORT;
    delete process.env.EXPRESS_PORT;
}

/**
 * Provisions a test eVault instance
 */
export async function provisionTestEVault(
    server: E2ETestServer,
    namespace: string = uuidv4(),
    verificationId: string = process.env.DEMO_CODE_W3DS || "d66b7138-538a-465f-a6ce-f6985854c3f4"
): Promise<ProvisionedEVault> {
    // Get the shared test key pair
    const { privateKey } = await getSharedTestKeyPair();

    // Generate a registry entropy token signed with the test private key
    const entropy = uuidv4();
    const token = await new jose.SignJWT({ entropy })
        .setProtectedHeader({ alg: "ES256", kid: "entropy-key-1" })
        .setIssuedAt()
        .setExpirationTime("1h")
        .sign(privateKey);

    // Provision via the service directly
    const result = await server.provisioningService.provisionEVault({
        registryEntropy: token,
        namespace,
        verificationId,
        publicKey: "0x0000000000000000000000000000000000000000",
    });

    if (!result.success || !result.w3id || !result.uri) {
        throw new Error(`Failed to provision eVault: ${result.error || result.message}`);
    }

    return {
        w3id: result.w3id,
        uri: result.uri,
    };
}

/**
 * Makes a GraphQL request to the evault-core server
 */
export async function makeGraphQLRequest<T = any>(
    server: E2ETestServer,
    query: string,
    variables?: Record<string, any>,
    headers?: Record<string, string>
): Promise<T> {
    const url = `http://localhost:${server.fastifyPort}/graphql`;
    
    const response = await axios.post(
        url,
        {
            query,
            variables,
        },
        {
            headers: {
                "Content-Type": "application/json",
                ...headers,
            },
        }
    );

    if (response.data.errors) {
        throw new Error(`GraphQL errors: ${JSON.stringify(response.data.errors)}`);
    }

    return response.data.data;
}

