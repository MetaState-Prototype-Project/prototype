import "reflect-metadata";
import path from "path";
import cors from "cors";
import dotenv from "dotenv";
import express, { type Request, type Response } from "express";
import type { Server as HttpServer } from "node:http";
import { AppDataSource } from "./config/database";
import { NotificationController } from "./controllers/NotificationController";
import { ProvisioningController } from "./controllers/ProvisioningController";
import { VerificationController } from "./controllers/VerificationController";
import { LegacyVerificationController } from "./controllers/LegacyVerificationController";
import { RecoveryController } from "./controllers/RecoveryController";
import { ProvisioningService } from "./services/ProvisioningService";
import { VerificationService } from "./services/VerificationService";
import { createHmacSignature } from "./utils/hmac";

import { checkGlobalRateLimit } from "./core/http/global-rate-limiter";
import { isGraphQLReadOperation } from "./core/http/graphql-rate-limit-intent";
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
import { ProtectedZoneService } from "./core/db/protected-zone.service";
import { connectWithRetry } from "./core/db/retry-neo4j";
import { registerHttpRoutes } from "./core/http/server";
import { GraphQLServer } from "./core/protocol/graphql-server";
import { LogService } from "./core/w3id/log-service";
import { AwarenessOutboxDispatcher } from "./core/awareness/awareness-outbox-dispatcher";

dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

const expressApp = express();
const expressPort = process.env.EXPRESS_PORT || process.env.PORT || 3001;
const fastifyPort = process.env.FASTIFY_PORT || process.env.PORT || 4000;

// Configure CORS for SSE
expressApp.use(
    cors({
        origin: "*",
        methods: ["GET", "POST", "OPTIONS", "PATCH"],
        allowedHeaders: [
            "Content-Type",
            "Authorization",
            "X-ENAME",
            "X-ON-BEHALF-OF",
            "x-shared-secret",
        ],
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
let legacyVerificationController: LegacyVerificationController;
let notificationController: NotificationController;
let provisioningController: ProvisioningController;

// eVault Core initialization
let fastifyServer: FastifyInstance;
let graphqlServer: GraphQLServer;
let logService: LogService;
let driver: Driver;
let provisioningService: ProvisioningService | undefined;
let awarenessOutboxDispatcher: AwarenessOutboxDispatcher | undefined;
let expressServer: HttpServer | undefined;

function rawBearerToken(request: FastifyRequest): string | null {
    const authHeader = request.headers.authorization;
    return typeof authHeader === "string" && authHeader.startsWith("Bearer ")
        ? authHeader.substring(7)
        : null;
}

function requestEName(request: FastifyRequest): string | null {
    const value = request.headers["x-ename"];
    return typeof value === "string" ? value : null;
}

function requestPath(request: FastifyRequest): string {
    return (request.raw.url || request.url).split("?", 1)[0] || "/";
}

/**
 * Only operations whose read-only nature is known after Fastify has parsed
 * the body receive tenant-isolated capacity. Unknown and broad endpoints stay
 * on the strict legacy budget; this prevents a caller from claiming a read
 * path for a mutation or cross-tenant enumeration.
 */
function isTenantScopedReadRequest(request: FastifyRequest): boolean {
    const path = requestPath(request);
    if (
        (request.method === "GET" || request.method === "HEAD") &&
        path.startsWith("/files/")
    ) {
        return true;
    }
    return (
        request.method === "POST" &&
        path === "/graphql" &&
        isGraphQLReadOperation(request.body)
    );
}

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

    // Create id indexes on Envelope and MetaEnvelope so per-field point
    // lookups inside updateMetaEnvelopeById don't scan the whole label.
    try {
        const { createIdIndexes } = await import(
            "./core/db/migrations/add-id-indexes"
        );
        await createIdIndexes(driver);
    } catch (error) {
        console.warn("Failed to create id indexes:", error);
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

    try {
        const { createAwarenessOutboxIndexes } = await import(
            "./core/db/migrations/add-awareness-outbox-indexes"
        );
        await createAwarenessOutboxIndexes(driver);
    } catch (error) {
        console.warn("Failed to create awareness outbox indexes:", error);
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
    awarenessOutboxDispatcher = new AwarenessOutboxDispatcher(driver);
    awarenessOutboxDispatcher.start();
    const protectedZoneService = new ProtectedZoneService(driver);
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
        // 350MB. Files are uploaded base64-encoded inside the GraphQL JSON body,
        // which inflates the raw request ~1.37x, so the body limit must exceed the
        // base64-encoded size of the largest allowed file (250MB binary ≈ 343MB
        // base64 + JSON overhead). Keep in sync with MAX_FILE_BYTES in graphql-server.ts.
        bodyLimit: 350 * 1024 * 1024,
    });

    // Register CORS plugin with relaxed settings
    await fastifyServer.register(fastifyCors, {
        origin: true, // Allow all origins
        methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allowedHeaders: [
            "Content-Type",
            "Authorization",
            "X-ENAME",
            "X-ON-BEHALF-OF",
            "x-shared-secret",
        ],
        credentials: true,
    });

    // Rate-limit after request parsing so a GraphQL operation can be proven to
    // be a query before it receives tenant-isolated read capacity. Mutations,
    // unknown documents, and broad HTTP endpoints retain the old strict quota.
    fastifyServer.addHook("preValidation", async (request, reply) => {
        const { allowed, retryAfterSeconds } = await checkGlobalRateLimit({
            token: rawBearerToken(request),
            ip: request.ip,
            eName: requestEName(request),
            intent: isTenantScopedReadRequest(request) ? "read" : "write",
        });
        if (!allowed) {
            // In an async Fastify hook, only returning the reply short-circuits
            // handler chain if you return the reply object. Without the
            // return, the 429 is queued but the downstream handler (GraphQL)
            // still runs — turning the rate limiter into a silent counter.
            return reply
                .code(429)
                .header("Retry-After", String(retryAfterSeconds))
                .send({
                    error: "Too Many Requests",
                    retryAfterSeconds,
                });
        }
    });

    // Register HTTP routes with provisioning service if available
    await registerHttpRoutes(
        fastifyServer,
        evaultInstance,
        provisioningServiceInstance,
        dbService,
        protectedZoneService,
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
        const {
            getProvisionerJwk,
        } = require("./core/utils/provisioner-signer");
        res.json({ keys: [getProvisionerJwk()] });
    } catch {
        res.json({ keys: [] });
    }
});

// Health check endpoint
expressApp.get("/health", (req: Request, res: Response) => {
    res.json({ status: "ok" });
});

expressApp.get("/ready", async (_req: Request, res: Response) => {
    try {
        await driver.getServerInfo();
        const dispatcher = awarenessOutboxDispatcher?.health();
        const dispatcherReady = Boolean(
            dispatcher?.configured && dispatcher.running,
        );
        const session = driver.session();
        try {
            const result = await session.run(`
                MATCH (a:AwarenessOutbox)
                WHERE a.status IN ['pending', 'failed', 'delivering']
                RETURN count(a) AS queued,
                       coalesce(max(timestamp() - a.createdAt), 0) AS oldestAgeMs
            `);
            const record = result.records[0];
            return res.status(dispatcherReady ? 200 : 503).json({
                status: dispatcherReady ? "ready" : "not-ready",
                neo4j: "ok",
                awarenessDispatcher: dispatcher ?? {
                    configured: false,
                    running: false,
                },
                awarenessOutbox: {
                    queued: record.get("queued").toNumber(),
                    oldestAgeMs: record.get("oldestAgeMs").toNumber(),
                },
            });
        } finally {
            await session.close();
        }
    } catch (error) {
        return res.status(503).json({
            status: "not-ready",
            neo4j: "unavailable",
            error: error instanceof Error ? error.message : String(error),
        });
    }
});

expressApp.get("/metrics", async (_req: Request, res: Response) => {
    try {
        const dispatcher = awarenessOutboxDispatcher?.health();
        const lastCycleAgeSeconds = dispatcher?.lastCycleAt
            ? Math.max(
                  0,
                  (Date.now() - dispatcher.lastCycleAt.getTime()) / 1000,
              )
            : -1;
        const session = driver.session();
        try {
            const result = await session.run(`
                MATCH (a:AwarenessOutbox)
                RETURN count(CASE WHEN a.status IN ['pending', 'failed', 'delivering'] THEN 1 END) AS queued,
                       count(CASE WHEN a.status = 'failed' THEN 1 END) AS failed,
                       coalesce(max(CASE WHEN a.status IN ['pending', 'failed', 'delivering'] THEN timestamp() - a.createdAt ELSE 0 END), 0) AS oldestAgeMs
            `);
            const record = result.records[0];
            return res
                .type("text/plain; version=0.0.4")
                .send(
                    [
                        "# TYPE evault_awareness_outbox_events gauge",
                        `evault_awareness_outbox_events{status=\"active\"} ${record.get("queued").toNumber()}`,
                        `evault_awareness_outbox_events{status=\"failed\"} ${record.get("failed").toNumber()}`,
                        "# TYPE evault_awareness_outbox_oldest_seconds gauge",
                        `evault_awareness_outbox_oldest_seconds ${record.get("oldestAgeMs").toNumber() / 1000}`,
                        "# TYPE evault_awareness_dispatcher_running gauge",
                        `evault_awareness_dispatcher_running ${dispatcher?.running ? 1 : 0}`,
                        "# TYPE evault_awareness_dispatcher_configured gauge",
                        `evault_awareness_dispatcher_configured ${dispatcher?.configured ? 1 : 0}`,
                        "# TYPE evault_awareness_dispatcher_last_cycle_age_seconds gauge",
                        `evault_awareness_dispatcher_last_cycle_age_seconds ${lastCycleAgeSeconds}`,
                        "",
                    ].join("\n"),
                );
        } finally {
            await session.close();
        }
    } catch (error) {
        return res
            .status(503)
            .type("text/plain")
            .send(
                `# metrics unavailable: ${error instanceof Error ? error.message : String(error)}\n`,
            );
    }
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
        legacyVerificationController = new LegacyVerificationController(
            verificationService,
        );
        const recoveryController = new RecoveryController(verificationService);

        // Register verification, notification, provisioning, and recovery routes
        legacyVerificationController.registerRoutes(expressApp);
        verificationController.registerRoutes(expressApp);
        notificationController.registerRoutes(expressApp);
        provisioningController.registerRoutes(expressApp);
        recoveryController.registerRoutes(expressApp);

        // Start eVault Core (Fastify + GraphQL) with provisioning service first
        await initializeEVault(provisioningService);

        // Start Express server for provisioning (after Fastify is ready)
        expressServer = expressApp.listen(expressPort, () => {
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

async function shutdown(signal: string): Promise<void> {
    console.log(`${signal} received, shutting down eVault`);
    await awarenessOutboxDispatcher?.stop();
    await fastifyServer?.close();
    if (expressServer) {
        await new Promise<void>((resolve) =>
            expressServer!.close(() => resolve()),
        );
    }
    await driver?.close();
    if (AppDataSource.isInitialized) await AppDataSource.destroy();
}

process.once("SIGTERM", () => void shutdown("SIGTERM"));
process.once("SIGINT", () => void shutdown("SIGINT"));
