import fastify, { FastifyInstance } from "fastify";
import { generateEntropy, generatePlatformToken, getJWK } from "../jwt";

export async function createMockRegistryServer(port: number = 4322): Promise<FastifyInstance> {
    const server = fastify({ logger: false });

    // Mock endpoints that evault-core calls
    server.get("/.well-known/jwks.json", async () => {
        return await getJWK();
    });

    server.post("/register", async (request, reply) => {
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

export async function stopMockRegistryServer(server: FastifyInstance): Promise<void> {
    await server.close();
}

