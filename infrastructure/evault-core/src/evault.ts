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

        const driver = neo4j.driver(uri, neo4j.auth.basic(user, password));
        const dbService = new DbService(driver);
        const gqlServer = new GraphQLServer(dbService);
        this.server = gqlServer.server as Server;
    }

    start() {
        const port = process.env.PORT ?? 4000;
        this.server.listen(port, () => {
            console.log(`GraphQL Server started on http://localhost:${port}`);
            console.log(`Voyager started on http://localhost:${port}`);
        });
    }
}

const evault = new EVault();
evault.start();
