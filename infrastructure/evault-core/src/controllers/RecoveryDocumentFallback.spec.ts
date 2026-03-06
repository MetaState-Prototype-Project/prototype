import "reflect-metadata";
import express from "express";
import { AddressInfo } from "node:net";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    diditGet: vi.fn(),
    diditPost: vi.fn(),
    axiosPost: vi.fn(),
}));

vi.mock("axios", () => {
    return {
        default: {
            create: vi.fn(() => ({
                get: mocks.diditGet,
                post: mocks.diditPost,
            })),
            post: mocks.axiosPost,
        },
    };
});

import { RecoveryController } from "./RecoveryController";

describe("Recovery document fallback", () => {
    const previousEnv = {
        DIDIT_API_KEY: process.env.DIDIT_API_KEY,
        PUBLIC_EVAULT_SERVER_URI: process.env.PUBLIC_EVAULT_SERVER_URI,
        PUBLIC_REGISTRY_URL: process.env.PUBLIC_REGISTRY_URL,
        PLATFORM_NAME: process.env.PLATFORM_NAME,
    };

    beforeEach(() => {
        process.env.DIDIT_API_KEY = "test-api-key";
        process.env.PUBLIC_EVAULT_SERVER_URI = "https://evault.example.com";
        process.env.PUBLIC_REGISTRY_URL = "https://registry.example.com";
        process.env.PLATFORM_NAME = "provisioner";
        mocks.diditGet.mockReset();
        mocks.diditPost.mockReset();
        mocks.axiosPost.mockReset();
    });

    afterEach(() => {
        process.env.DIDIT_API_KEY = previousEnv.DIDIT_API_KEY;
        process.env.PUBLIC_EVAULT_SERVER_URI = previousEnv.PUBLIC_EVAULT_SERVER_URI;
        process.env.PUBLIC_REGISTRY_URL = previousEnv.PUBLIC_REGISTRY_URL;
        process.env.PLATFORM_NAME = previousEnv.PLATFORM_NAME;
    });

    it("recovers by uppercased document number when face-search has no matches", async () => {
        const verificationServiceStub = {
            create: async () => ({}),
            findByIdAndUpdate: async () => null,
            findOne: async () => null,
            findManyAndCount: vi.fn(async ({ documentId }: { documentId: string }) => {
                if (documentId === "CAA000000") {
                    return [[{
                        linkedEName: "@existing-recovery-user",
                        updatedAt: new Date(),
                    }], 1];
                }
                return [[], 0];
            }),
        } as any;

        mocks.diditGet.mockImplementation(async (url: string) => {
            if (url.includes("/decision/")) {
                return {
                    data: {
                        liveness_checks: [
                            {
                                status: "Approved",
                                reference_image: "https://example.com/reference.jpg",
                            },
                        ],
                        id_verifications: [
                            {
                                document_number: "caa000000",
                                full_name: "Case Test",
                            },
                        ],
                    },
                };
            }
            return {
                data: Buffer.from("image-data"),
                headers: {
                    "content-type": "image/jpeg",
                },
            };
        });

        mocks.diditPost.mockResolvedValue({
            data: {
                face_search: {
                    matches: [],
                },
            },
        });

        mocks.axiosPost
            .mockResolvedValueOnce({ data: { token: "platform-token" } }) // /platforms/certification
            .mockResolvedValueOnce({
                data: {
                    data: {
                        bindingDocuments: {
                            edges: [],
                        },
                    },
                },
            }) // query existing binding docs
            .mockResolvedValueOnce({
                data: {
                    data: {
                        createBindingDocument: {
                            errors: [],
                        },
                    },
                },
            }); // create id_document if missing

        const app = express();
        app.use(express.json());
        new RecoveryController(verificationServiceStub).registerRoutes(app);

        const server = app.listen(0);
        const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

        try {
            const response = await fetch(`${baseUrl}/recovery/face-search`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    diditSessionId: "11111111-2222-4333-8444-555555555555",
                }),
            });
            const body = await response.json();

            expect(response.status).toBe(200);
            expect(body.success).toBe(true);
            expect(body.w3id).toBe("@existing-recovery-user");
            expect(body.idVerif?.document_number).toBe("CAA000000");
            expect(mocks.axiosPost).toHaveBeenCalled();
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
