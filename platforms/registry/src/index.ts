import fastify from "fastify";
import { generateEntropy, getJWK } from "./jwt";
import dotenv from "dotenv";
import path from "path";
import { AppDataSource } from "./config/database";
import { VaultService } from "./services/VaultService";

dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

const server = fastify({ logger: true });

// Initialize database connection
const initializeDatabase = async () => {
    try {
        await AppDataSource.initialize();
        server.log.info("Database connection initialized");
    } catch (error) {
        server.log.error("Error during database initialization:", error);
        process.exit(1);
    }
};

// Initialize VaultService
const vaultService = new VaultService(AppDataSource.getRepository("Vault"));

// Generate and return a signed JWT with entropy
server.get("/entropy", async (request, reply) => {
  try {
    const token = await generateEntropy();
    return { token };
  } catch (error) {
    server.log.error(error);
    reply.status(500).send({ error: "Failed to generate entropy" });
  }
});

// Expose the JWK used for signing
server.get("/.well-known/jwks.json", async (request, reply) => {
  try {
    const jwk = await getJWK();
    return jwk;
  } catch (error) {
    server.log.error(error);
    reply.status(500).send({ error: "Failed to get JWK" });
  }
});

// Resolve service from database based on w3id
server.get("/resolve", async (request, reply) => {
  try {
    const { w3id } = request.query as { w3id: string };
    if (!w3id) {
      return reply.status(400).send({ error: "w3id parameter is required" });
    }

    const service = await vaultService.findByEname(w3id);
    
    if (!service) {
      return reply.status(404).send({ error: "Service not found" });
    }

    return {
      ename: service.ename,
      uri: service.uri,
      evault: service.evault
    };
  } catch (error) {
    server.log.error(error);
    reply.status(500).send({ error: "Failed to resolve service" });
  }
});

const start = async () => {
  try {
    await initializeDatabase();
    await server.listen({ port: 4321, host: "0.0.0.0" });
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();
