import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import axios from "axios";
import * as jose from "jose";
import {
    setupE2ETestServer,
    teardownE2ETestServer,
    provisionTestEVault,
    makeGraphQLRequest,
    type E2ETestServer,
    type ProvisionedEVault,
} from "../../test-utils/e2e-setup";
import { getSharedTestKeyPair } from "../../test-utils/shared-test-keys";

// Store original axios functions before any spying happens
const originalAxiosPost = axios.post;

// evault-core forwards every awareness packet to AaaS at
// AWARENESS_SERVICE_URL/ingest; point it somewhere the spy can intercept.
process.env.AWARENESS_SERVICE_URL = "http://localhost:9999";

describe("GraphQLServer Awareness Ingest Payload W3ID", () => {
    let server: E2ETestServer;
    let evault1: ProvisionedEVault;
    let evault2: ProvisionedEVault;
    const evaultW3ID = "evault-w3id-123";
    let axiosPostSpy: any;

    beforeAll(async () => {
        server = await setupE2ETestServer();
        evault1 = await provisionTestEVault(server);
        evault2 = await provisionTestEVault(server);
    }, 120000);

    afterAll(async () => {
        await teardownE2ETestServer(server);
        if (axiosPostSpy) {
            axiosPostSpy.mockRestore();
        }
    });

    beforeEach(() => {
        if (axiosPostSpy) {
            axiosPostSpy.mockRestore();
        }

        vi.clearAllMocks();

        // Spy on axios.post to capture the awareness ingest payload.
        axiosPostSpy = vi.spyOn(axios, "post").mockImplementation((url: string | any, data?: any, config?: any) => {
            // If it's the AaaS ingest call, capture it and return success.
            if (typeof url === "string" && url.includes("/ingest")) {
                console.log("Ingest intercepted:", { url, data });
                return Promise.resolve({ status: 200, data: { ok: true } }) as any;
            }
            // For GraphQL and other requests, call through to original.
            return originalAxiosPost.call(axios, url, data, config);
        });
    });

    describe("storeMetaEnvelope ingest payload", () => {
        it("should include X-ENAME in the ingest payload", async () => {
            const testData = { field: "value", test: "store-test" };
            const testOntology = "WebhookTestOntology";

            // Make GraphQL mutation with user's W3ID in X-ENAME header
            const mutation = `
                mutation StoreMetaEnvelope($input: MetaEnvelopeInput!) {
                    storeMetaEnvelope(input: $input) {
                        metaEnvelope {
                            id
                            ontology
                        }
                    }
                }
            `;

            await makeGraphQLRequest(server, mutation, {
                input: {
                    ontology: testOntology,
                    payload: testData,
                    acl: ["*"],
                },
            }, {
                "X-ENAME": evault1.w3id,
            });

            // notifyAwareness is fire-and-forget; give it a moment to run.
            await new Promise(resolve => setTimeout(resolve, 1000));

            // Verify axios.post was called (awareness ingest)
            expect(axios.post).toHaveBeenCalled();

            // Get the ingest payload from the axios.post call
            const ingestCalls = (axios.post as any).mock.calls;
            const ingestCall = ingestCalls.find((call: any[]) =>
                typeof call[0] === "string" && call[0].includes("/ingest")
            );

            expect(ingestCall).toBeDefined();
            const ingestPayload = ingestCall[1]; // Second argument is the payload

            console.log("Ingest payload:", JSON.stringify(ingestPayload, null, 2));
            console.log("Expected w3id:", evault1.w3id);

            // Verify the payload contains the user's W3ID, not the eVault's W3ID
            expect(ingestPayload).toBeDefined();
            expect(ingestPayload.w3id).toBe(evault1.w3id);
            expect(ingestPayload.w3id).not.toBe(evaultW3ID);
            expect(ingestPayload.data).toEqual(testData);
            expect(ingestPayload.schemaId).toBe(testOntology);
        });

        it("should use different W3IDs for different users in ingest payloads", async () => {
            const testData1 = { user: "1", data: "test1" };
            const testData2 = { user: "2", data: "test2" };
            const testOntology = "MultiUserWebhookTest";

            const mutation = `
                mutation StoreMetaEnvelope($input: MetaEnvelopeInput!) {
                    storeMetaEnvelope(input: $input) {
                        metaEnvelope {
                            id
                            ontology
                        }
                    }
                }
            `;

            // Store for user1
            await makeGraphQLRequest(server, mutation, {
                input: {
                    ontology: testOntology,
                    payload: testData1,
                    acl: ["*"],
                },
            }, {
                "X-ENAME": evault1.w3id,
            });

            // Store for user2
            await makeGraphQLRequest(server, mutation, {
                input: {
                    ontology: testOntology,
                    payload: testData2,
                    acl: ["*"],
                },
            }, {
                "X-ENAME": evault2.w3id,
            });

            // Give the fire-and-forget ingest calls a moment to run.
            await new Promise(resolve => setTimeout(resolve, 1000));

            // Get all ingest calls
            const ingestCalls = (axios.post as any).mock.calls.filter((call: any[]) =>
                typeof call[0] === "string" && call[0].includes("/ingest")
            );

            expect(ingestCalls.length).toBeGreaterThanOrEqual(2);

            // Find payloads by their data
            const payload1 = ingestCalls.find((call: any[]) =>
                call[1]?.data?.user === "1"
            )?.[1];
            const payload2 = ingestCalls.find((call: any[]) =>
                call[1]?.data?.user === "2"
            )?.[1];

            expect(payload1).toBeDefined();
            expect(payload1.w3id).toBe(evault1.w3id);
            expect(payload2).toBeDefined();
            expect(payload2.w3id).toBe(evault2.w3id);
            expect(payload1.w3id).not.toBe(payload2.w3id);
        });
    });

    describe("updateMetaEnvelopeById ingest payload", () => {
        it("should include user's W3ID (eName) in the ingest payload, not eVault's W3ID", async () => {
            const testData = { field: "updated-value", test: "update-test" };
            const testOntology = "UpdateWebhookTestOntology";

            // First, create an envelope
            const createMutation = `
                mutation StoreMetaEnvelope($input: MetaEnvelopeInput!) {
                    storeMetaEnvelope(input: $input) {
                        metaEnvelope {
                            id
                            ontology
                        }
                    }
                }
            `;

            const createResult = await makeGraphQLRequest(server, createMutation, {
                input: {
                    ontology: testOntology,
                    payload: { field: "initial-value" },
                    acl: ["*"],
                },
            }, {
                "X-ENAME": evault1.w3id,
            });

            const envelopeId = createResult.storeMetaEnvelope.metaEnvelope.id;

            // Clear previous ingest calls
            (axios.post as any).mockClear();

            // Now update the envelope
            const updateMutation = `
                mutation UpdateMetaEnvelopeById($id: String!, $input: MetaEnvelopeInput!) {
                    updateMetaEnvelopeById(id: $id, input: $input) {
                        metaEnvelope {
                            id
                            ontology
                        }
                    }
                }
            `;

            // Create a valid Bearer token for authentication.
            const { privateKey } = await getSharedTestKeyPair();
            const testToken = await new jose.SignJWT({ platform: "http://localhost:3000" })
                .setProtectedHeader({ alg: "ES256", kid: "entropy-key-1" })
                .setIssuedAt()
                .setExpirationTime("1h")
                .sign(privateKey);

            await makeGraphQLRequest(server, updateMutation, {
                id: envelopeId,
                input: {
                    ontology: testOntology,
                    payload: testData,
                    acl: ["*"],
                },
            }, {
                "X-ENAME": evault1.w3id,
                "Authorization": `Bearer ${testToken}`,
            });

            // Give the fire-and-forget ingest call a moment to run.
            await new Promise(resolve => setTimeout(resolve, 1000));

            // Verify axios.post was called (awareness ingest)
            expect(axios.post).toHaveBeenCalled();

            // Get the ingest payload
            const ingestCalls = (axios.post as any).mock.calls.filter((call: any[]) =>
                typeof call[0] === "string" && call[0].includes("/ingest")
            );

            expect(ingestCalls.length).toBeGreaterThan(0);
            const ingestPayload = ingestCalls[0][1];

            // Verify the payload contains the user's W3ID, not the eVault's W3ID
            expect(ingestPayload).toBeDefined();
            expect(ingestPayload.w3id).toBe(evault1.w3id);
            expect(ingestPayload.w3id).not.toBe(evaultW3ID);
            expect(ingestPayload.id).toBe(envelopeId);
            expect(ingestPayload.data).toEqual(testData);
            expect(ingestPayload.schemaId).toBe(testOntology);
        });
    });
});
