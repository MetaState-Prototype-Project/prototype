import fastify, { FastifyInstance } from "fastify";
// Mock getJWK - we don't need to import from registry in tests
async function mockGetJWK() {
    return {
        keys: [{
            kty: "EC",
            crv: "P-256",
            x: "test-x",
            y: "test-y",
            kid: "entropy-key-1",
            alg: "ES256",
        }],
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
        return reply.status(201).send({ ename, uri, evault });
    });

    server.get("/platforms", async () => {
        return [
            "http://localhost:1111",
            "http://localhost:3000",
        ];
    });

    await server.listen({ port, host: "0.0.0.0" });

    return server;
}

export async function stopMockRegistryServer(server: FastifyInstance | undefined): Promise<void> {
    if (server) {
        await server.close();
    }
}

