import neo4j from "neo4j-driver";
import { DbService } from "./db/db.service";
import { GraphQLServer } from "./protocol/graphql-server";

async function startEVault() {
    const uri = `bolt://localhost:7687`;
    const driver = neo4j.driver(uri, neo4j.auth.basic("neo4j", "testpass"));
    const dbService = new DbService(driver);
    new GraphQLServer(dbService);
}

startEVault();
