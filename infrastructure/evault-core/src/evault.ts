import { DbService } from "./db/db.service";
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
import neo4j from "neo4j-driver";

dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

class EVault {
    server: FastifyInstance;
    graphqlServer: GraphQLServer;

    constructor() {
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

        const driver = neo4j.driver(uri, neo4j.auth.basic(user, password));
        const dbService = new DbService(driver);
        this.graphqlServer = new GraphQLServer(dbService);

        // Create Fastify server
        this.server = fastify({
            logger: true,
        });
    }

    async initialize() {
        // Register HTTP routes
        await registerHttpRoutes(this.server);

        // Create Yoga instance with the schema from GraphQLServer
        const yoga = createYoga({
            schema: this.graphqlServer.getSchema(),
            graphiql: true,
        });

        // Mount GraphQL endpoint
        this.server.route({
            url: "/graphql",
            method: ["GET", "POST", "OPTIONS"],
            handler: async (req: FastifyRequest, reply: FastifyReply) => {
                const response = await yoga.handleNodeRequest(
                    req.raw,
                    reply.raw,
                );
                response.headers.forEach((value, key) => {
                    reply.header(key, value);
                });
                reply.status(response.status);
                reply.send(response.body);
                return reply;
            },
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
            `API Documentation available at http://0.0.0.0:${port}/documentation`,
        );
    }
}

const evault = new EVault();
evault.start().catch(console.error);
