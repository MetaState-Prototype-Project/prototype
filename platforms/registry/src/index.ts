import fastify from "fastify";
import { generateEntropy, generatePlatformToken, getJWK } from "./jwt";
import dotenv from "dotenv";
import path from "node:path";
import { AppDataSource } from "./config/database";
import { VaultService } from "./services/VaultService";
import { UriResolutionService } from "./services/UriResolutionService";
import { KubernetesService } from "./services/KubernetesService";
import cors from "@fastify/cors";

import fs from "node:fs";

function loadMotdJSON() {
    const motdJSON = fs.readFileSync(path.resolve(__dirname, "../motd.json"), "utf8");
    return JSON.parse(motdJSON) as {
        status: "up" | "maintenance"
        message: string
    };
}

let motd = loadMotdJSON();

fs.watchFile(path.resolve(__dirname, "../motd.json"), (_curr, _prev) => {
    motd = loadMotdJSON();
});

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

// Initialize UriResolutionService for health checks and Kubernetes fallbacks
const uriResolutionService = new UriResolutionService();

// Initialize KubernetesService for debugging
const kubernetesService = new KubernetesService();

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

server.get("/motd", async (request, reply) => {
    return motd;
});

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
    const platforms = [ 
        process.env.PUBLIC_PICTIQUE_BASE_URL, 
        process.env.PUBLIC_BLABSY_BASE_URL, 
        process.env.PUBLIC_GROUP_CHARTER_BASE_URL, 
        process.env.PUBLIC_CERBERUS_BASE_URL, 
        process.env.PUBLIC_EVOTING_BASE_URL,
    ]

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

// Debug endpoint for Kubernetes connectivity (remove in production)
server.get("/debug/kubernetes", async (request, reply) => {
    try {
        const debugInfo = await kubernetesService.debugExternalIps();
        reply.send({
            status: "ok",
            timestamp: new Date().toISOString(),
            kubernetes: debugInfo
        });
    } catch (error) {
        reply.status(500).send({
            error: "Failed to get Kubernetes debug info",
            message: error instanceof Error ? error.message : String(error)
        });
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

        // Resolve the URI with health check and Kubernetes fallback
        const resolvedUri = await uriResolutionService.resolveUri(vault.uri);

        return {
            ename: vault.ename,
            uri: resolvedUri,
            evault: vault.evault,
            originalUri: vault.uri, // Include original URI for debugging
            resolved: resolvedUri !== vault.uri, // Flag if URI was resolved
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
        
        // Resolve URIs for all vaults
        const resolvedVaults = await Promise.all(
            vaults.map(async (vault) => {
                const resolvedUri = await uriResolutionService.resolveUri(vault.uri);
                return {
                    ename: vault.ename,
                    uri: resolvedUri,
                    evault: vault.evault,
                    originalUri: vault.uri,
                    resolved: resolvedUri !== vault.uri,
                };
            })
        );
        
        return resolvedVaults;
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
