import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import axios from "axios";
import {
    setupE2ETestServer,
    teardownE2ETestServer,
    provisionTestEVault,
    makeGraphQLRequest,
    type E2ETestServer,
    type ProvisionedEVault,
} from "../../test-utils/e2e-setup";

describe("GraphQLServer Webhook Payload W3ID", () => {
    let server: E2ETestServer;
    let evault1: ProvisionedEVault;
    let evault2: ProvisionedEVault;
    const evaultW3ID = "evault-w3id-123";
    let realAxios: typeof axios;

    beforeAll(async () => {
        // Get real axios before any spying
        realAxios = (await vi.importActual<typeof axios>("axios")) as typeof axios;
        
        server = await setupE2ETestServer();
        evault1 = await provisionTestEVault(server);
        evault2 = await provisionTestEVault(server);
    }, 120000);

    afterAll(async () => {
        await teardownE2ETestServer(server);
    });

    beforeEach(() => {
        vi.clearAllMocks();
        
        // Mock axios.get for platforms endpoint only
        vi.spyOn(axios, "get").mockImplementation((url: string | any) => {
            if (typeof url === "string" && url.includes("/platforms")) {
                return Promise.resolve({
                    data: ["http://localhost:9999"], // Mock platform URL
                }) as any;
            }
            // For other GET requests, call through to real axios
            return realAxios.get(url);
        });

        // Spy on axios.post to capture webhook payloads
        // For webhook calls, return success. For others, call through to real axios
        vi.spyOn(axios, "post").mockImplementation((url: string | any, data?: any, config?: any) => {
            // If it's a webhook call, capture it and return success
            if (typeof url === "string" && url.includes("/api/webhook")) {
                return Promise.resolve({ status: 200, data: {} }) as any;
            }
            // For GraphQL and other requests, call through to real axios
            return realAxios.post(url, data, config);
        });
    });

    describe("storeMetaEnvelope webhook payload", () => {
        it("should include user's W3ID (eName) in webhook payload, not eVault's W3ID", async () => {
            const testData = { field: "value", test: "store-test" };
            const testOntology = "WebhookTestOntology";

            // Make GraphQL mutation with user's W3ID in X-ENAME header
            const mutation = `
                mutation StoreMetaEnvelope($input: StoreMetaEnvelopeInput!) {
                    storeMetaEnvelope(input: $input) {
                        id
                        ontology
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

            // Wait for the setTimeout delay (3 seconds) in the actual code
            await new Promise(resolve => setTimeout(resolve, 3500));

            // Verify axios.post was called (webhook delivery)
            expect(axios.post).toHaveBeenCalled();
            
            // Get the webhook payload from the axios.post call
            const webhookCalls = (axios.post as any).mock.calls;
            const webhookCall = webhookCalls.find((call: any[]) => 
                typeof call[0] === "string" && call[0].includes("/api/webhook")
            );

            expect(webhookCall).toBeDefined();
            const webhookPayload = webhookCall[1]; // Second argument is the payload

            // Verify the webhook payload contains the user's W3ID, not the eVault's W3ID
            expect(webhookPayload).toBeDefined();
            expect(webhookPayload.w3id).toBe(evault1.w3id);
            expect(webhookPayload.w3id).not.toBe(evaultW3ID);
            expect(webhookPayload.data).toEqual(testData);
            expect(webhookPayload.schemaId).toBe(testOntology);
        });

        it("should use different W3IDs for different users in webhook payloads", async () => {
            const testData1 = { user: "1", data: "test1" };
            const testData2 = { user: "2", data: "test2" };
            const testOntology = "MultiUserWebhookTest";

            const mutation = `
                mutation StoreMetaEnvelope($input: StoreMetaEnvelopeInput!) {
                    storeMetaEnvelope(input: $input) {
                        id
                        ontology
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

            // Wait for setTimeout delays
            await new Promise(resolve => setTimeout(resolve, 3500));

            // Get all webhook calls
            const webhookCalls = (axios.post as any).mock.calls.filter((call: any[]) => 
                typeof call[0] === "string" && call[0].includes("/api/webhook")
            );

            expect(webhookCalls.length).toBeGreaterThanOrEqual(2);

            // Find payloads by their data
            const payload1 = webhookCalls.find((call: any[]) => 
                call[1]?.data?.user === "1"
            )?.[1];
            const payload2 = webhookCalls.find((call: any[]) => 
                call[1]?.data?.user === "2"
            )?.[1];

            expect(payload1).toBeDefined();
            expect(payload1.w3id).toBe(evault1.w3id);
            expect(payload2).toBeDefined();
            expect(payload2.w3id).toBe(evault2.w3id);
            expect(payload1.w3id).not.toBe(payload2.w3id);
        });
    });

    describe("updateMetaEnvelopeById webhook payload", () => {
        it("should include user's W3ID (eName) in webhook payload, not eVault's W3ID", async () => {
            const testData = { field: "updated-value", test: "update-test" };
            const testOntology = "UpdateWebhookTestOntology";

            // First, create an envelope
            const createMutation = `
                mutation StoreMetaEnvelope($input: StoreMetaEnvelopeInput!) {
                    storeMetaEnvelope(input: $input) {
                        id
                        ontology
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

            const envelopeId = createResult.storeMetaEnvelope.id;

            // Clear previous webhook calls
            (axios.post as any).mockClear();

            // Now update the envelope
            const updateMutation = `
                mutation UpdateMetaEnvelopeById($id: String!, $input: UpdateMetaEnvelopeInput!) {
                    updateMetaEnvelopeById(id: $id, input: $input) {
                        id
                        ontology
                    }
                }
            `;

            await makeGraphQLRequest(server, updateMutation, {
                id: envelopeId,
                input: {
                    ontology: testOntology,
                    payload: testData,
                    acl: ["*"],
                },
            }, {
                "X-ENAME": evault1.w3id,
            });

            // Wait a bit for webhook delivery (update doesn't have setTimeout delay)
            await new Promise(resolve => setTimeout(resolve, 500));

            // Verify axios.post was called (webhook delivery)
            expect(axios.post).toHaveBeenCalled();
            
            // Get the webhook payload
            const webhookCalls = (axios.post as any).mock.calls.filter((call: any[]) => 
                typeof call[0] === "string" && call[0].includes("/api/webhook")
            );

            expect(webhookCalls.length).toBeGreaterThan(0);
            const webhookPayload = webhookCalls[0][1];

            // Verify the webhook payload contains the user's W3ID, not the eVault's W3ID
            expect(webhookPayload).toBeDefined();
            expect(webhookPayload.w3id).toBe(evault1.w3id);
            expect(webhookPayload.w3id).not.toBe(evaultW3ID);
            expect(webhookPayload.id).toBe(envelopeId);
            expect(webhookPayload.data).toEqual(testData);
            expect(webhookPayload.schemaId).toBe(testOntology);
        });
    });
});

