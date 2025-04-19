import { DbService } from "./db/db.service";
import { GraphQLServer } from "./protocol/graphql-server";

async function startEVault() {
    const dbService = new DbService();
    new GraphQLServer(dbService);
}

startEVault();
