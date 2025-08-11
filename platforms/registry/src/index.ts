import fastify from "fastify";
import { generateEntropy, generatePlatformToken, getJWK } from "./jwt";
import dotenv from "dotenv";
import path from "path";
import { AppDataSource } from "./config/database";
import { VaultService } from "./services/VaultService";
import cors from "@fastify/cors";

dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

const server = fastify({ logger: true });

// Register CORS
server.register(cors, {
    origin: "*",
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
});

// Initialize database connection
const initializeDatabase = async () => {
    try {
        await AppDataSource.initialize();
        server.log.info("Database connection initialized");
    } catch (error) {
        server.log.error({message: "Error during database initialization", detail: error});
        process.exit(1);
    }
};

// Initialize VaultService
const vaultService = new VaultService(AppDataSource.getRepository("Vault"));

// Middleware to check shared secret
const checkSharedSecret = async (request: any, reply: any) => {
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return reply
            .status(401)
            .send({ error: "Missing or invalid authorization header" });
    }

    const secret = authHeader.split(" ")[1];
    if (secret !== process.env.REGISTRY_SHARED_SECRET) {
        return reply.status(401).send({ error: "Invalid shared secret" });
    }
};

// Create a new vault entry
server.post(
    "/register",
    {
        preHandler: checkSharedSecret,
    },
    async (request, reply) => {
        try {
            const { ename, uri, evault } = request.body as {
                ename: string;
                uri: string;
                evault: string;
            };

            if (!ename || !uri || !evault) {
                return reply.status(400).send({
                    error: "Missing required fields. Please provide ename, uri, and evault",
                });
            }

            const vault = await vaultService.create(ename, uri, evault);
            return reply.status(201).send(vault);
        } catch (error) {
            server.log.error(error);
            reply.status(500).send({ error: "Failed to create vault entry" });
        }
    },
);

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

server.post("/platforms/certification", async (request, reply) => {
    try {
        const { platform } = request.body as { platform: string };
        const token = await generatePlatformToken(platform);
        return { token };
    } catch (error) {
        server.log.error(error);
        reply.status(500).send({ error: "Failed to generate platform token" });
    }
});

server.get("/platforms", async (request, reply) => {
    const platforms = [ process.env.PUBLIC_PICTIQUE_BASE_URL, process.env.PUBLIC_BLABSY_BASE_URL, process.env.PUBLIC_GROUP_CHARTER_BASE_URL, process.env.PUBLIC_CERBERUS_BASE_URL ]

    return platforms
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
            return reply
                .status(400)
                .send({ error: "w3id parameter is required" });
        }

        const vault = await vaultService.findByEname(w3id);
        if (!vault) {
            return reply.status(404).send({ error: "Service not found" });
        }

        return {
            ename: vault.ename,
            uri: vault.uri,
            evault: vault.evault,
        };
    } catch (error) {
        server.log.error(error);
        reply.status(500).send({ error: "Failed to resolve service" });
    }
});

// List all vault entries
server.get("/list", async (request, reply) => {
    try {
        const vaults = await vaultService.findAll();
        return vaults.map(vault => ({
            ename: vault.ename,
            uri: vault.uri,
            evault: vault.evault,
        }));
    } catch (error) {
        server.log.error(error);
        reply.status(500).send({ error: "Failed to list vault entries" });
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
