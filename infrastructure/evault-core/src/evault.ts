import { Server } from "http";
import { DbService } from "./db/db.service";
import { GraphQLServer } from "./protocol/graphql-server";
import dotenv from "dotenv";
import path from "path";
import neo4j from "neo4j-driver";

dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

class EVault {
    server: Server;

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
        const gqlServer = new GraphQLServer(dbService);
        this.server = gqlServer.server as Server;
    }

    start() {
        const port = process.env.NOMAD_PORT_http || process.env.PORT || 4000;
        this.server.listen(Number(port), "0.0.0.0", () => {
            console.log(`GraphQL Server started on http://0.0.0.0:${port}`);
            console.log(`Voyager started on http://0.0.0.0:${port}`);
        });
    }
}

const evault = new EVault();
evault.start();
