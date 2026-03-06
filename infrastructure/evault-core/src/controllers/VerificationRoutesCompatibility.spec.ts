import "reflect-metadata";
import express from "express";
import { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { LegacyVerificationController } from "./LegacyVerificationController";
import { VerificationController } from "./VerificationController";

describe("Verification route compatibility", () => {
    const previousSecret = process.env.PROVISIONER_SHARED_SECRET;

    beforeAll(() => {
        process.env.PROVISIONER_SHARED_SECRET = "test-shared-secret";
    });

    afterAll(() => {
        process.env.PROVISIONER_SHARED_SECRET = previousSecret;
    });

    function buildServer() {
        const app = express();
        app.use(express.json());

        const verificationServiceStub = {
            findById: async () => null,
            findOne: async () => null,
            create: async () => ({ id: "00000000-0000-0000-0000-000000000000" }),
            findByIdAndUpdate: async () => null,
            findManyAndCount: async () => [[], 0] as const,
        } as any;

        new LegacyVerificationController(verificationServiceStub).registerRoutes(app);
        new VerificationController(verificationServiceStub).registerRoutes(app);

        return app.listen(0);
    }

    async function closeServer(server: ReturnType<typeof buildServer>) {
        await new Promise<void>((resolve, reject) => {
            server.close((error) => {
                if (error) reject(error);
                else resolve();
            });
        });
    }

    it("serves legacy /verification/:id without shared-secret", async () => {
        const server = buildServer();
        const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

        try {
            const response = await fetch(`${baseUrl}/verification/not-found`);
            expect(response.status).toBe(404);
        } finally {
            await closeServer(server);
        }
    });

    it("requires shared-secret for /verification/v2/:id", async () => {
        const server = buildServer();
        const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

        try {
            const response = await fetch(`${baseUrl}/verification/v2/not-found`);
            expect(response.status).toBe(401);
        } finally {
            await closeServer(server);
        }
    });

    it("allows /verification/v2/:id when shared-secret is present", async () => {
        const server = buildServer();
        const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

        try {
            const response = await fetch(`${baseUrl}/verification/v2/not-found`, {
                headers: {
                    "x-shared-secret": "test-shared-secret",
                },
            });
            expect(response.status).toBe(404);
        } finally {
            await closeServer(server);
        }
    });
});
