import fastify, { FastifyInstance } from "fastify";
import { getSharedTestPublicJWK } from "./shared-test-keys";

// In-memory store for registered eVaults
const registeredEVaults = new Map<string, { uri: string; evault: string }>();

// Mock getJWK - returns the public key from the shared test key pair
async function mockGetJWK() {
    const publicKeyOnly = await getSharedTestPublicJWK();
    return {
        keys: [publicKeyOnly],
    };
}

export async function createMockRegistryServer(port: number = 4322): Promise<FastifyInstance> {
    const server = fastify({ logger: false });

    // Mock endpoints that evault-core calls
    server.get("/.well-known/jwks.json", async () => {
        return await mockGetJWK();
    });

    server.post("/register", async (request, reply) => {
        const authHeader = request.headers.authorization;
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return reply.status(401).send({ error: "Unauthorized" });
        }

        const { ename, uri, evault } = request.body as any;
        if (!ename || !uri || !evault) {
            return reply.status(400).send({ error: "Missing required fields" });
        }
        
        // Store the registered eVault for resolution
        registeredEVaults.set(ename, { uri, evault });
        
        return reply.status(201).send({ ename, uri, evault });
    });

    server.get("/resolve", async (request, reply) => {
        const { w3id } = request.query as { w3id?: string };
        
        if (!w3id) {
            return reply.status(400).send({ error: "Missing w3id parameter" });
        }

        // Normalize w3id (remove @ prefix if present for lookup)
        const normalizedW3id = w3id.startsWith("@") ? w3id.substring(1) : w3id;
        const registered = registeredEVaults.get(normalizedW3id) || registeredEVaults.get(w3id);
        
        if (!registered) {
            return reply.status(404).send({ error: "eVault not found" });
        }

        return reply.status(200).send({ uri: registered.uri });
    });

    server.get("/platforms", async () => {
        return [
            "http://localhost:1111",
            "http://localhost:3000",
        ];
    });

    server.post("/platforms/certification", async (request, reply) => {
        const { platform } = request.body as { platform?: string };
        
        if (!platform) {
            return reply.status(400).send({ error: "Missing platform parameter" });
        }

        // Return a mock JWT token for the platform
        // In a real scenario, this would be a proper JWT signed by the registry
        const mockToken = `mock.jwt.token.${platform}.${Date.now()}`;
        
        return reply.status(200).send({
            token: mockToken,
            expiresAt: Date.now() + 3600000, // 1 hour from now
        });
    });

    await server.listen({ port, host: "0.0.0.0" });

    return server;
}

export async function stopMockRegistryServer(server: FastifyInstance | undefined): Promise<void> {
    if (server) {
        await server.close();
    }
}

