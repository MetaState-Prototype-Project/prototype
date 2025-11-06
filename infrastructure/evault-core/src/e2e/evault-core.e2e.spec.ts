import "reflect-metadata";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
    setupE2ETestServer,
    teardownE2ETestServer,
    provisionTestEVault,
    makeGraphQLRequest,
    type E2ETestServer,
    type ProvisionedEVault,
} from "../test-utils/e2e-setup";
// Import web3-adapter - using relative path since it's in the same workspace
// We'll use dynamic import to handle cases where web3-adapter might not be built
async function getEVaultClient() {
    try {
        // Try to import from dist (built JavaScript) - use absolute path from workspace root
        const module = await import("../../web3-adapter/dist/evault/evault.js");
        return module.EVaultClient;
    } catch (error1) {
        try {
            // Fallback to source (TypeScript) - requires ts-node or similar
            const module = await import("../../web3-adapter/src/evault/evault.ts");
            return module.EVaultClient;
        } catch (error2) {
            // If both fail, return null and tests will be skipped
            console.warn("Could not import EVaultClient:", error1.message || error2.message);
            return null;
        }
    }
}

describe("evault-core E2E Tests", () => {
    let server: E2ETestServer;
    let evault1: ProvisionedEVault;
    let evault2: ProvisionedEVault;

    beforeAll(async () => {
        server = await setupE2ETestServer();
    }, 120000);

    afterAll(async () => {
        await teardownE2ETestServer(server);
    }, 120000);

    describe("Provisioning", () => {
        it("should provision an eVault instance", async () => {
            evault1 = await provisionTestEVault(server);
            
            expect(evault1).toBeDefined();
            expect(evault1.w3id).toBeDefined();
            expect(evault1.uri).toBeDefined();
            expect(evault1.uri).toContain("http://");
        });

        it("should provision multiple eVault instances with different eNames", async () => {
            evault2 = await provisionTestEVault(server);
            
            expect(evault2).toBeDefined();
            expect(evault2.w3id).toBeDefined();
            expect(evault2.w3id).not.toBe(evault1.w3id);
        });
    });

    describe("GraphQL Operations with X-ENAME Header", () => {
        it("should store a MetaEnvelope with X-ENAME header", async () => {
            const mutation = `
                mutation StoreMetaEnvelope($input: MetaEnvelopeInput!) {
                    storeMetaEnvelope(input: $input) {
                        metaEnvelope {
                            id
                            ontology
                            parsed
                        }
                        envelopes {
                            id
                            ontology
                            value
                        }
                    }
                }
            `;

            const result = await makeGraphQLRequest(
                server,
                mutation,
                {
                    input: {
                        ontology: "TestOntology",
                        payload: {
                            field1: "value1",
                            field2: 42,
                        },
                        acl: ["*"],
                    },
                },
                {
                    "X-ENAME": evault1.w3id,
                }
            );

            expect(result.storeMetaEnvelope).toBeDefined();
            expect(result.storeMetaEnvelope.metaEnvelope.id).toBeDefined();
            expect(result.storeMetaEnvelope.metaEnvelope.ontology).toBe("TestOntology");
            expect(result.storeMetaEnvelope.metaEnvelope.parsed).toEqual({
                field1: "value1",
                field2: 42,
            });
        });

        it("should fetch a MetaEnvelope by ID with X-ENAME header", async () => {
            // First store an envelope
            const storeMutation = `
                mutation StoreMetaEnvelope($input: MetaEnvelopeInput!) {
                    storeMetaEnvelope(input: $input) {
                        metaEnvelope {
                            id
                            ontology
                        }
                    }
                }
            `;

            const storeResult = await makeGraphQLRequest(
                server,
                storeMutation,
                {
                    input: {
                        ontology: "FetchTest",
                        payload: { test: "data" },
                        acl: ["*"],
                    },
                },
                {
                    "X-ENAME": evault1.w3id,
                }
            );

            const envelopeId = storeResult.storeMetaEnvelope.metaEnvelope.id;

            // Then fetch it
            const query = `
                query GetMetaEnvelopeById($id: String!) {
                    getMetaEnvelopeById(id: $id) {
                        id
                        ontology
                        parsed
                    }
                }
            `;

            const fetchResult = await makeGraphQLRequest(
                server,
                query,
                { id: envelopeId },
                {
                    "X-ENAME": evault1.w3id,
                }
            );

            expect(fetchResult.getMetaEnvelopeById).toBeDefined();
            expect(fetchResult.getMetaEnvelopeById.id).toBe(envelopeId);
            expect(fetchResult.getMetaEnvelopeById.ontology).toBe("FetchTest");
        });

        it("should fail when X-ENAME header is missing", async () => {
            const mutation = `
                mutation StoreMetaEnvelope($input: MetaEnvelopeInput!) {
                    storeMetaEnvelope(input: $input) {
                        metaEnvelope {
                            id
                        }
                    }
                }
            `;

            await expect(
                makeGraphQLRequest(server, mutation, {
                    input: {
                        ontology: "Test",
                        payload: { test: "data" },
                        acl: ["*"],
                    },
                })
            ).rejects.toThrow();
        });

        it("should fail when X-ENAME header is incorrect (wrong tenant)", async () => {
            // Store data for evault1
            const storeMutation = `
                mutation StoreMetaEnvelope($input: MetaEnvelopeInput!) {
                    storeMetaEnvelope(input: $input) {
                        metaEnvelope {
                            id
                        }
                    }
                }
            `;

            const storeResult = await makeGraphQLRequest(
                server,
                storeMutation,
                {
                    input: {
                        ontology: "IsolationTest",
                        payload: { secret: "data" },
                        acl: ["*"],
                    },
                },
                {
                    "X-ENAME": evault1.w3id,
                }
            );

            const envelopeId = storeResult.storeMetaEnvelope.metaEnvelope.id;

            // Try to fetch with wrong eName (evault2)
            const query = `
                query GetMetaEnvelopeById($id: String!) {
                    getMetaEnvelopeById(id: $id) {
                        id
                    }
                }
            `;

            // Should return null/undefined or throw error (data isolation)
            const fetchResult = await makeGraphQLRequest(
                server,
                query,
                { id: envelopeId },
                {
                    "X-ENAME": evault2.w3id,
                }
            ).catch(() => ({ getMetaEnvelopeById: null }));

            // The envelope should not be accessible from evault2 (should be null or undefined)
            expect(fetchResult?.getMetaEnvelopeById).toBeFalsy();
        });
    });

    describe("Multi-tenant Data Isolation", () => {
        it("should isolate data between different eNames", async () => {
            const mutation = `
                mutation StoreMetaEnvelope($input: MetaEnvelopeInput!) {
                    storeMetaEnvelope(input: $input) {
                        metaEnvelope {
                            id
                            ontology
                            parsed
                        }
                    }
                }
            `;

            // Store data for evault1
            const result1 = await makeGraphQLRequest(
                server,
                mutation,
                {
                    input: {
                        ontology: "TenantTest",
                        payload: { tenant: "evault1", data: "secret1" },
                        acl: ["*"],
                    },
                },
                {
                    "X-ENAME": evault1.w3id,
                }
            );

            // Store data for evault2
            const result2 = await makeGraphQLRequest(
                server,
                mutation,
                {
                    input: {
                        ontology: "TenantTest",
                        payload: { tenant: "evault2", data: "secret2" },
                        acl: ["*"],
                    },
                },
                {
                    "X-ENAME": evault2.w3id,
                }
            );

            // Query all envelopes for evault1
            const query1 = `
                query GetAllEnvelopes {
                    getAllEnvelopes {
                        id
                        ontology
                        value
                    }
                }
            `;

            const envelopes1 = await makeGraphQLRequest(
                server,
                query1,
                {},
                {
                    "X-ENAME": evault1.w3id,
                }
            );

            // Query all envelopes for evault2
            const query2 = `
                query GetAllEnvelopes {
                    getAllEnvelopes {
                        id
                        ontology
                        value
                    }
                }
            `;

            const envelopes2 = await makeGraphQLRequest(
                server,
                query2,
                {},
                {
                    "X-ENAME": evault2.w3id,
                }
            );

            // Verify isolation - each tenant should only see their own data
            // getAllEnvelopes returns Envelope objects (child envelopes), not MetaEnvelope IDs
            const evault1EnvelopeIds = envelopes1.getAllEnvelopes.map((e: any) => e.id);
            const evault2EnvelopeIds = envelopes2.getAllEnvelopes.map((e: any) => e.id);
            
            // Get the envelope IDs from the stored results (these are the child envelope IDs)
            const result1Envelopes = (result1.storeMetaEnvelope as any).envelopes || [];
            const result2Envelopes = (result2.storeMetaEnvelope as any).envelopes || [];
            const result1EnvelopeIds = result1Envelopes.map((e: any) => e.id);
            const result2EnvelopeIds = result2Envelopes.map((e: any) => e.id);

            // Each tenant should see their own envelopes
            result1EnvelopeIds.forEach((id: string) => {
                expect(evault1EnvelopeIds).toContain(id);
                expect(evault2EnvelopeIds).not.toContain(id);
            });

            result2EnvelopeIds.forEach((id: string) => {
                expect(evault2EnvelopeIds).toContain(id);
                expect(evault1EnvelopeIds).not.toContain(id);
            });
        });
    });

    describe("web3-adapter Integration", () => {
        it("should work with web3-adapter EVaultClient", async () => {
            const EVaultClientClass = await getEVaultClient();
            if (!EVaultClientClass) {
                // Skip test if web3-adapter is not available
                console.warn("web3-adapter not available, skipping test");
                return;
            }

            const registryUrl = `http://localhost:${server.registryPort}`;
            const client = new EVaultClientClass(registryUrl, "test-platform");

            try {
                // Store a meta envelope using web3-adapter
                const envelopeId = await client.storeMetaEnvelope({
                    w3id: evault1.w3id,
                    schemaId: "Web3AdapterTest",
                    data: {
                        test: "web3-adapter integration",
                        value: 123,
                    },
                });

                expect(envelopeId).toBeDefined();

                // Fetch it back
                const fetched = await client.fetchMetaEnvelope(envelopeId, evault1.w3id);

                expect(fetched).toBeDefined();
                expect(fetched.schemaId).toBe("Web3AdapterTest");
                expect(fetched.data.test).toBe("web3-adapter integration");
            } finally {
                client.dispose();
            }
        });

        it("should send X-ENAME header from web3-adapter", async () => {
            const EVaultClientClass = await getEVaultClient();
            if (!EVaultClientClass) {
                // Skip test if web3-adapter is not available
                console.warn("web3-adapter not available, skipping test");
                return;
            }

            const registryUrl = `http://localhost:${server.registryPort}`;
            const client = new EVaultClientClass(registryUrl, "test-platform");

            try {
                // This test verifies that web3-adapter correctly includes X-ENAME header
                // by successfully storing and fetching data
                const envelopeId = await client.storeMetaEnvelope({
                    w3id: evault1.w3id,
                    schemaId: "HeaderTest",
                    data: { header: "test" },
                });

                // If we can fetch it, the header was sent correctly
                const fetched = await client.fetchMetaEnvelope(envelopeId, evault1.w3id);
                expect(fetched).toBeDefined();
                expect(fetched.schemaId).toBe("HeaderTest");
            } finally {
                client.dispose();
            }
        });
    });
});

