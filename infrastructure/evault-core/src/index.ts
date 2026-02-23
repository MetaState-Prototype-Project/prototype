import "reflect-metadata";
import path from "path";
import cors from "cors";
import dotenv from "dotenv";
import express, { type Request, type Response } from "express";
import { AppDataSource } from "./config/database";
import { NotificationController } from "./controllers/NotificationController";
import { ProvisioningController } from "./controllers/ProvisioningController";
import { VerificationController } from "./controllers/VerificationController";
import { ProvisioningService } from "./services/ProvisioningService";
import { VerificationService } from "./services/VerificationService";
import { createHmacSignature } from "./utils/hmac";

import fastifyCors from "@fastify/cors";
import fastify, {
    type FastifyInstance,
    type FastifyRequest,
    type FastifyReply,
} from "fastify";
import { renderVoyagerPage } from "graphql-voyager/middleware";
import neo4j, { type Driver } from "neo4j-driver";
// Import evault-core functionality
import { DbService } from "./core/db/db.service";
import { connectWithRetry } from "./core/db/retry-neo4j";
import { registerHttpRoutes } from "./core/http/server";
import { GraphQLServer } from "./core/protocol/graphql-server";
import { LogService } from "./core/w3id/log-service";

dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

const expressApp = express();
const expressPort = process.env.EXPRESS_PORT || process.env.PORT || 3001;
const fastifyPort = process.env.FASTIFY_PORT || process.env.PORT || 4000;

// Configure CORS for SSE
expressApp.use(
    cors({
        origin: "*",
        methods: ["GET", "POST", "OPTIONS", "PATCH"],
        allowedHeaders: ["Content-Type", "Authorization", "X-ENAME"],
        credentials: true,
    }),
);

// Increase JSON payload limit to 50MB
expressApp.use(express.json({ limit: "250mb" }));
expressApp.use(express.urlencoded({ limit: "250mb", extended: true }));

// Initialize database connection
const initializeDatabase = async () => {
    try {
        await AppDataSource.initialize();
        console.log("PostgreSQL database connection initialized");
    } catch (error) {
        console.error("Error during database initialization:", error);
        process.exit(1);
    }
};

// Initialize services and controllers
let verificationService: VerificationService;
let verificationController: VerificationController;
let notificationController: NotificationController;
let provisioningController: ProvisioningController;

// eVault Core initialization
let fastifyServer: FastifyInstance;
let graphqlServer: GraphQLServer;
let logService: LogService;
let driver: Driver;
let provisioningService: ProvisioningService | undefined;

// Initialize eVault Core
const initializeEVault = async (
    provisioningServiceInstance?: ProvisioningService,
) => {
    const uri = process.env.NEO4J_URI || "bolt://localhost:7687";
    const user = process.env.NEO4J_USER || "neo4j";
    const password = process.env.NEO4J_PASSWORD || "neo4j";

    if (
        !process.env.NEO4J_URI ||
        !process.env.NEO4J_USER ||
        !process.env.NEO4J_PASSWORD
    ) {
        console.warn(
            "Using default Neo4j connection parameters. Set NEO4J_URI, NEO4J_USER, and NEO4J_PASSWORD environment variables for custom configuration.",
        );
    }

    driver = await connectWithRetry(uri, user, password);

    // Create eName index for multi-tenant performance
    try {
        const { createENameIndex } = await import(
            "./core/db/migrations/add-ename-index"
        );
        await createENameIndex(driver);
    } catch (error) {
        console.warn("Failed to create eName index:", error);
    }

    // Create User index for public key lookups
    try {
        const { createUserIndex } = await import(
            "./core/db/migrations/add-user-index"
        );
        await createUserIndex(driver);
    } catch (error) {
        console.warn("Failed to create User index:", error);
    }

    // Migrate publicKey (string) to publicKeys (array)
    try {
        const { migratePublicKeyToArray } = await import(
            "./core/db/migrations/migrate-publickey-to-array"
        );
        await migratePublicKeyToArray(driver);
    } catch (error) {
        console.warn("Failed to migrate publicKey to publicKeys array:", error);
    }

    // Create EnvelopeOperationLog indexes for /logs endpoint
    try {
        const { createEnvelopeOperationLogIndexes } = await import(
            "./core/db/migrations/add-envelope-operation-log-index"
        );
        await createEnvelopeOperationLogIndexes(driver);
    } catch (error) {
        console.warn("Failed to create EnvelopeOperationLog indexes:", error);
    }

    // One-time backfill: create operation logs for existing metaenvelopes (platform inferred from ontology)
    try {
        const { backfillEnvelopeOperationLogs } = await import(
            "./core/db/migrations/backfill-envelope-operation-logs"
        );
        await backfillEnvelopeOperationLogs(driver);
    } catch (error) {
        console.warn("Failed to backfill envelope operation logs:", error);
    }

    const dbService = new DbService(driver);
    logService = new LogService(driver);
    const publicKey = process.env.EVAULT_PUBLIC_KEY || null;
    const w3id = process.env.W3ID || null;

    const evaultInstance = {
        publicKey,
        w3id,
        evaultId: process.env.EVAULT_ID || undefined,
    };

    graphqlServer = new GraphQLServer(
        dbService,
        publicKey,
        w3id,
        evaultInstance,
    );

    fastifyServer = fastify({
        logger: true,
        bodyLimit: 20 * 1024 * 1024, // 20MB (default is 1MB; needed for createMetaEnvelope etc.)
    });

    // Register CORS plugin with relaxed settings
    await fastifyServer.register(fastifyCors, {
        origin: true, // Allow all origins
        methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allowedHeaders: ["Content-Type", "Authorization", "X-ENAME"],
        credentials: true,
    });

    // Register HTTP routes with provisioning service if available
    await registerHttpRoutes(
        fastifyServer,
        evaultInstance,
        provisioningServiceInstance,
        dbService,
    );

    // Setup GraphQL
    const yoga = graphqlServer.init();

    fastifyServer.route({
        url: yoga.graphqlEndpoint,
        method: ["GET", "POST", "OPTIONS"],
        handler: (req, reply) => yoga.handleNodeRequestAndResponse(req, reply),
    });

    // Mount Voyager endpoint
    fastifyServer.get(
        "/voyager",
        (req: FastifyRequest, reply: FastifyReply) => {
            reply.type("text/html").send(
                renderVoyagerPage({
                    endpointUrl: "/graphql",
                }),
            );
        },
    );

    // Start Fastify server
    await fastifyServer.listen({ port: Number(fastifyPort), host: "0.0.0.0" });
    console.log(
        `Fastify server (GraphQL/HTTP) started on http://0.0.0.0:${fastifyPort}`,
    );
    console.log(
        `GraphQL endpoint available at http://0.0.0.0:${fastifyPort}/graphql`,
    );
    console.log(
        `GraphQL Voyager available at http://0.0.0.0:${fastifyPort}/voyager`,
    );
    console.log(
        `API Documentation available at http://0.0.0.0:${fastifyPort}/docs`,
    );
};

// Provisioner JWKs — must be on Express (provisioner URL port) for signer URL resolution
expressApp.get("/.well-known/jwks.json", (_req: Request, res: Response) => {
    try {
        const { getProvisionerJwk } = require("./core/utils/provisioner-signer");
        res.json({ keys: [getProvisionerJwk()] });
    } catch {
        res.json({ keys: [] });
    }
});

// Health check endpoint
expressApp.get("/health", (req: Request, res: Response) => {
    res.json({ status: "ok" });
});

// Start the server
const start = async () => {
    try {
        await initializeDatabase();

        // Initialize services
        const { Verification } = await import("./entities/Verification");
        verificationService = new VerificationService(
            AppDataSource.getRepository(Verification),
        );
        notificationController = new NotificationController();

        // Initialize provisioning service (uses shared AppDataSource)
        provisioningService = new ProvisioningService(verificationService);
        provisioningController = new ProvisioningController(
            provisioningService,
        );

        // VerificationController must be created AFTER provisioningService so the
        // upgrade route has a valid provisioningService reference.
        verificationController = new VerificationController(
            verificationService,
            provisioningService,
        );

        // Register verification, notification, and provisioning routes
        verificationController.registerRoutes(expressApp);
        notificationController.registerRoutes(expressApp);
        provisioningController.registerRoutes(expressApp);

        // Start eVault Core (Fastify + GraphQL) with provisioning service first
        await initializeEVault(provisioningService);

        // Start Express server for provisioning (after Fastify is ready)
        expressApp.listen(expressPort, () => {
            console.log(
                `Express server (Provisioning API) running on port ${expressPort}`,
            );
        });
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

start();
