import "reflect-metadata";
import express from "express";
import { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { RecoveryController } from "./RecoveryController";
import { VerificationController } from "./VerificationController";

describe("Session ID validation in controllers", () => {
    const previousEnv = {
        PROVISIONER_SHARED_SECRET: process.env.PROVISIONER_SHARED_SECRET,
        DIDIT_API_KEY: process.env.DIDIT_API_KEY,
        PUBLIC_EVAULT_SERVER_URI: process.env.PUBLIC_EVAULT_SERVER_URI,
    };

    beforeAll(() => {
        process.env.PROVISIONER_SHARED_SECRET = "test-shared-secret";
        process.env.DIDIT_API_KEY = "test-api-key";
        process.env.PUBLIC_EVAULT_SERVER_URI = "https://evault.example.com";
    });

    afterAll(() => {
        process.env.PROVISIONER_SHARED_SECRET = previousEnv.PROVISIONER_SHARED_SECRET;
        process.env.DIDIT_API_KEY = previousEnv.DIDIT_API_KEY;
        process.env.PUBLIC_EVAULT_SERVER_URI = previousEnv.PUBLIC_EVAULT_SERVER_URI;
    });

    it("rejects invalid diditSessionId in /recovery/face-search", async () => {
        const app = express();
        app.use(express.json());

        const verificationServiceStub = {
            create: async () => ({}),
            findByIdAndUpdate: async () => null,
            findOne: async () => null,
        } as any;

        new RecoveryController(verificationServiceStub).registerRoutes(app);

        const server = app.listen(0);
        const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

        try {
            const response = await fetch(`${baseUrl}/recovery/face-search`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ diditSessionId: "../etc/passwd" }),
            });
            const body = await response.json();

            expect(response.status).toBe(400);
            expect(body.error).toContain("valid UUID");
        } finally {
            await new Promise<void>((resolve, reject) => {
                server.close((error) => {
                    if (error) reject(error);
                    else resolve();
                });
            });
        }
    });

    it("rejects invalid sessionId in /verification/v2/decision/:sessionId", async () => {
        const app = express();
        app.use(express.json());

        const verificationServiceStub = {
            findById: async () => null,
            findOne: async () => null,
            create: async () => ({}),
            findByIdAndUpdate: async () => null,
        } as any;

        new VerificationController(verificationServiceStub).registerRoutes(app);

        const server = app.listen(0);
        const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

        try {
            const response = await fetch(
                `${baseUrl}/verification/v2/decision/not-a-uuid`,
                {
                    method: "GET",
                    headers: {
                        "x-shared-secret": "test-shared-secret",
                    },
                },
            );
            const body = await response.json();

            expect(response.status).toBe(400);
            expect(body.error).toContain("valid UUID");
        } finally {
            await new Promise<void>((resolve, reject) => {
                server.close((error) => {
                    if (error) reject(error);
                    else resolve();
                });
            });
        }
    });
});
