import { DbService } from "./db/db.service";
import { LogService } from "./w3id/log-service";
import { GraphQLServer } from "./protocol/graphql-server";
import { registerHttpRoutes } from "./http/server";
import fastify, {
    FastifyInstance,
    FastifyRequest,
    FastifyReply,
} from "fastify";
import { renderVoyagerPage } from "graphql-voyager/middleware";
import { createYoga } from "graphql-yoga";
import dotenv from "dotenv";
import path from "path";
import neo4j, { Driver } from "neo4j-driver";
import { W3ID } from "./w3id/w3id";
import { connectWithRetry } from "./db/retry-neo4j";

dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

class EVault {
    server: FastifyInstance;
    graphqlServer: GraphQLServer;
    logService: LogService;
    driver: Driver;

    private constructor(driver: Driver) {
        this.driver = driver;
        const dbService = new DbService(driver);
        this.logService = new LogService(driver);
        this.graphqlServer = new GraphQLServer(dbService);
        this.server = fastify({
            logger: true,
        });
    }

    static async create(): Promise<EVault> {
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

        const driver = await connectWithRetry(uri, user, password);
        return new EVault(driver);
    }

    async initialize() {
        await registerHttpRoutes(this.server);

        const w3id = await W3ID.get({
            id: process.env.W3ID as string,
            driver: this.driver,
            password: process.env.ENCRYPTION_PASSWORD,
        });

        const yoga = this.graphqlServer.init();

        this.server.route({
            // Bind to the Yoga's endpoint to avoid rendering on any path
            url: yoga.graphqlEndpoint,
            method: ["GET", "POST", "OPTIONS"],
            handler: (req, reply) =>
                yoga.handleNodeRequestAndResponse(req, reply),
        });

        // Mount Voyager endpoint
        this.server.get(
            "/voyager",
            (req: FastifyRequest, reply: FastifyReply) => {
                reply.type("text/html").send(
                    renderVoyagerPage({
                        endpointUrl: "/graphql",
                    }),
                );
            },
        );
    }

    async start() {
        await this.initialize();

        const port = process.env.NOMAD_PORT_http || process.env.PORT || 4000;

        await this.server.listen({ port: Number(port), host: "0.0.0.0" });
        console.log(`Server started on http://0.0.0.0:${port}`);
        console.log(
            `GraphQL endpoint available at http://0.0.0.0:${port}/graphql`,
        );
        console.log(
            `GraphQL Voyager available at http://0.0.0.0:${port}/voyager`,
        );
        console.log(
            `API Documentation available at http://0.0.0.0:${port}/docs`,
        );
    }
}

EVault.create()
    .then(evault => evault.start())
    .catch(console.error);
