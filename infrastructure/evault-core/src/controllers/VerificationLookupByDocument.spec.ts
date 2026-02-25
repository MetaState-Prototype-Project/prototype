import "reflect-metadata";
import express from "express";
import { AddressInfo } from "node:net";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    diditGet: vi.fn(),
}));

vi.mock("axios", () => {
    return {
        default: {
            create: vi.fn(() => ({
                get: mocks.diditGet,
                post: vi.fn(),
            })),
            post: vi.fn(),
        },
    };
});

import { VerificationController } from "./VerificationController";

describe("Verification lookup-by-document v2", () => {
    const previousEnv = {
        PROVISIONER_SHARED_SECRET: process.env.PROVISIONER_SHARED_SECRET,
        DIDIT_API_KEY: process.env.DIDIT_API_KEY,
    };

    beforeEach(() => {
        process.env.PROVISIONER_SHARED_SECRET = "test-shared-secret";
        process.env.DIDIT_API_KEY = "test-api-key";
        mocks.diditGet.mockReset();
    });

    afterEach(() => {
        process.env.PROVISIONER_SHARED_SECRET = previousEnv.PROVISIONER_SHARED_SECRET;
        process.env.DIDIT_API_KEY = previousEnv.DIDIT_API_KEY;
    });

    it("returns existingW3id using uppercase-normalized document number", async () => {
        const verificationServiceStub = {
            findById: async () => null,
            findOne: async () => null,
            create: async () => ({}),
            findByIdAndUpdate: async () => null,
            findManyAndCount: vi.fn(async ({ documentId }: { documentId: string }) => {
                if (documentId === "CAA000000") {
                    return [[{
                        linkedEName: "@existing-user",
                        updatedAt: new Date(),
                    }], 1];
                }
                return [[], 0];
            }),
        } as any;

        mocks.diditGet.mockResolvedValue({
            data: {
                id_verifications: [
                    {
                        document_number: "caa000000",
                    },
                ],
            },
        });

        const app = express();
        app.use(express.json());
        new VerificationController(verificationServiceStub).registerRoutes(app);

        const server = app.listen(0);
        const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

        try {
            const response = await fetch(
                `${baseUrl}/verification/v2/lookup-by-document/11111111-2222-4333-8444-555555555555`,
                {
                    headers: {
                        "x-shared-secret": "test-shared-secret",
                    },
                },
            );
            const body = await response.json();

            expect(response.status).toBe(200);
            expect(body.success).toBe(true);
            expect(body.existingW3id).toBe("@existing-user");
            expect(body.documentNumber).toBe("CAA000000");
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
