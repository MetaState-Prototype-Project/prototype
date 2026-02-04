import "reflect-metadata";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
    setupE2ETestServer,
    teardownE2ETestServer,
    provisionTestEVault,
    type E2ETestServer,
    type ProvisionedEVault,
} from "../test-utils/e2e-setup";

// Import web3-adapter - using relative path since it's in the same workspace
// We'll use dynamic import to handle cases where web3-adapter might not be built
async function getEVaultClient() {
    try {
        // Try to import from dist (built JavaScript) - path from evault-core/src/e2e/
        const module = await import("../../../web3-adapter/dist/evault/evault.js");
        return module.EVaultClient;
    } catch (error1: unknown) {
        // If dist import fails, web3-adapter needs to be built
        const errorMessage = error1 instanceof Error ? error1.message : String(error1);
        console.warn("Could not import EVaultClient from dist:", errorMessage);
        console.warn("Please build web3-adapter first: pnpm -F=web3-adapter build");
        return null;
    }
}

describe("web3-adapter + evault-core Integration", () => {
    let server: E2ETestServer;
    let evault1: ProvisionedEVault;
    let evault2: ProvisionedEVault;
    let EVaultClientClass: any;

    beforeAll(async () => {
        server = await setupE2ETestServer();
        
        // Get EVaultClient class - fail early if not available
        EVaultClientClass = await getEVaultClient();
        if (!EVaultClientClass) {
            throw new Error("EVaultClient not available - web3-adapter must be built");
        }
    }, 120000);

    afterAll(async () => {
        await teardownE2ETestServer(server);
    }, 120000);

    describe("Setup", () => {
        it("should provision eVault instances for testing", async () => {
            evault1 = await provisionTestEVault(server);
            
            expect(evault1).toBeDefined();
            expect(evault1.w3id).toBeDefined();
            expect(evault1.uri).toBeDefined();
            expect(evault1.uri).toContain("http://");

            evault2 = await provisionTestEVault(server);
            
            expect(evault2).toBeDefined();
            expect(evault2.w3id).toBeDefined();
            expect(evault2.w3id).not.toBe(evault1.w3id);
        });
    });

    describe("CRUD Operations", () => {
        let client: any;

        beforeAll(() => {
            const registryUrl = `http://localhost:${server.registryPort}`;
            client = new EVaultClientClass(registryUrl, "test-platform");
        });

        afterAll(() => {
            if (client) {
                client.dispose();
            }
        });

        describe("storeMetaEnvelope", () => {
            it("should store a meta envelope with X-ENAME header", async () => {
                const envelopeId = await client.storeMetaEnvelope({
                    w3id: evault1.w3id,
                    schemaId: "TestOntology",
                    data: {
                        field1: "value1",
                        field2: 42,
                        nested: {
                            key: "nested-value",
                        },
                    },
                });

                expect(envelopeId).toBeDefined();
                expect(typeof envelopeId).toBe("string");
                expect(envelopeId.length).toBeGreaterThan(0);
            });

            it("should store different data types correctly", async () => {
                const envelopeId = await client.storeMetaEnvelope({
                    w3id: evault1.w3id,
                    schemaId: "MixedTypes",
                    data: {
                        string: "text",
                        number: 123,
                        boolean: true,
                        array: [1, 2, 3],
                        object: { nested: "value" },
                        nullValue: null,
                    },
                });

                expect(envelopeId).toBeDefined();
            });

            it("should store empty payload", async () => {
                const envelopeId = await client.storeMetaEnvelope({
                    w3id: evault1.w3id,
                    schemaId: "EmptyPayload",
                    data: {},
                });

                expect(envelopeId).toBeDefined();
            });
        });

        describe("fetchMetaEnvelope", () => {
            it("should fetch a stored meta envelope", async () => {
                // Store first
                const storedData = {
                    test: "fetch-test",
                    value: 456,
                };
                const envelopeId = await client.storeMetaEnvelope({
                    w3id: evault1.w3id,
                    schemaId: "FetchTest",
                    data: storedData,
                });

                // Then fetch
                const fetched = await client.fetchMetaEnvelope(envelopeId, evault1.w3id);

                expect(fetched).toBeDefined();
                expect(fetched.schemaId).toBe("FetchTest");
                expect(fetched.data).toEqual(storedData);
                expect(fetched.w3id).toBe(evault1.w3id);
            });

            it("should fetch complex nested data correctly", async () => {
                const complexData = {
                    level1: {
                        level2: {
                            level3: "deep-value",
                            array: [1, 2, { nested: "in-array" }],
                        },
                    },
                };

                const envelopeId = await client.storeMetaEnvelope({
                    w3id: evault1.w3id,
                    schemaId: "ComplexData",
                    data: complexData,
                });

                const fetched = await client.fetchMetaEnvelope(envelopeId, evault1.w3id);
                expect(fetched.data).toEqual(complexData);
            });
        });

        describe("updateMetaEnvelopeById", () => {
            it("should update an existing meta envelope", async () => {
                // Store initial data
                const initialData = {
                    status: "initial",
                    count: 0,
                };
                const envelopeId = await client.storeMetaEnvelope({
                    w3id: evault1.w3id,
                    schemaId: "UpdateTest",
                    data: initialData,
                });

                // Update with new data
                const updatedData = {
                    status: "updated",
                    count: 100,
                    newField: "added",
                };
                await client.updateMetaEnvelopeById(envelopeId, {
                    w3id: evault1.w3id,
                    schemaId: "UpdateTest",
                    data: updatedData,
                });

                // Verify update
                const fetched = await client.fetchMetaEnvelope(envelopeId, evault1.w3id);
                expect(fetched.data).toEqual(updatedData);
                expect(fetched.data.status).toBe("updated");
                expect(fetched.data.count).toBe(100);
                expect(fetched.data.newField).toBe("added");
            });

            it("should update with partial data", async () => {
                const initialData = {
                    field1: "value1",
                    field2: "value2",
                    field3: "value3",
                };
                const envelopeId = await client.storeMetaEnvelope({
                    w3id: evault1.w3id,
                    schemaId: "PartialUpdate",
                    data: initialData,
                });

                // Update only some fields
                const partialUpdate = {
                    field1: "updated-value1",
                    field2: "updated-value2",
                };
                await client.updateMetaEnvelopeById(envelopeId, {
                    w3id: evault1.w3id,
                    schemaId: "PartialUpdate",
                    data: partialUpdate,
                });

                const fetched = await client.fetchMetaEnvelope(envelopeId, evault1.w3id);
                // Note: updateMetaEnvelopeById replaces the entire payload, not merges
                expect(fetched.data).toEqual(partialUpdate);
            });
        });

        describe("storeReference", () => {
            it("should store a reference to another envelope", async () => {
                // Store a target envelope
                const targetData = { target: "data" };
                const targetId = await client.storeMetaEnvelope({
                    w3id: evault1.w3id,
                    schemaId: "Target",
                    data: targetData,
                });

                // Store a reference to it
                await client.storeReference(targetId, evault1.w3id);

                // References are stored as envelopes with _by_reference field
                // We can verify by checking the reference was created
                expect(targetId).toBeDefined();
            });

            it("should store multiple references", async () => {
                const target1 = await client.storeMetaEnvelope({
                    w3id: evault1.w3id,
                    schemaId: "RefTarget1",
                    data: { id: 1 },
                });
                const target2 = await client.storeMetaEnvelope({
                    w3id: evault1.w3id,
                    schemaId: "RefTarget2",
                    data: { id: 2 },
                });

                await client.storeReference(target1, evault1.w3id);
                await client.storeReference(target2, evault1.w3id);

                expect(target1).toBeDefined();
                expect(target2).toBeDefined();
            });
        });
    });

    describe("Multi-tenant Operations", () => {
        let client: any;

        beforeAll(() => {
            const registryUrl = `http://localhost:${server.registryPort}`;
            client = new EVaultClientClass(registryUrl, "test-platform");
        });

        afterAll(() => {
            if (client) {
                client.dispose();
            }
        });

        it("should use same client instance for multiple eVaults", async () => {
            // Store data for evault1
            const data1 = { tenant: "evault1", secret: "secret1" };
            const id1 = await client.storeMetaEnvelope({
                w3id: evault1.w3id,
                schemaId: "MultiTenant",
                data: data1,
            });

            // Store data for evault2 using same client
            const data2 = { tenant: "evault2", secret: "secret2" };
            const id2 = await client.storeMetaEnvelope({
                w3id: evault2.w3id,
                schemaId: "MultiTenant",
                data: data2,
            });

            expect(id1).toBeDefined();
            expect(id2).toBeDefined();
            expect(id1).not.toBe(id2);
        });

        it("should isolate data between different eNames", async () => {
            // Store data for evault1
            const secret1 = "secret-data-1";
            const id1 = await client.storeMetaEnvelope({
                w3id: evault1.w3id,
                schemaId: "IsolationTest",
                data: { secret: secret1 },
            });

            // Store data for evault2
            const secret2 = "secret-data-2";
            const id2 = await client.storeMetaEnvelope({
                w3id: evault2.w3id,
                schemaId: "IsolationTest",
                data: { secret: secret2 },
            });

            // Fetch evault1's data with evault1's w3id
            const fetched1 = await client.fetchMetaEnvelope(id1, evault1.w3id);
            expect(fetched1.data.secret).toBe(secret1);

            // Fetch evault2's data with evault2's w3id
            const fetched2 = await client.fetchMetaEnvelope(id2, evault2.w3id);
            expect(fetched2.data.secret).toBe(secret2);

            // Try to fetch evault1's data with evault2's w3id - should fail or return null
            await expect(
                client.fetchMetaEnvelope(id1, evault2.w3id)
            ).rejects.toThrow();

            // Try to fetch evault2's data with evault1's w3id - should fail or return null
            await expect(
                client.fetchMetaEnvelope(id2, evault1.w3id)
            ).rejects.toThrow();
        });

        it("should prevent cross-tenant updates", async () => {
            // Store data for evault1
            const id1 = await client.storeMetaEnvelope({
                w3id: evault1.w3id,
                schemaId: "CrossTenantUpdate",
                data: { original: "data" },
            });

            // Update with evault2's w3id creates a separate envelope for evault2 (in-place creation)
            await client.updateMetaEnvelopeById(id1, {
                w3id: evault2.w3id,
                schemaId: "CrossTenantUpdate",
                data: { hacked: "data" },
            });

            // Verify original data in evault1 is still intact (isolation maintained)
            const fetched = await client.fetchMetaEnvelope(id1, evault1.w3id);
            expect(fetched.data.original).toBe("data");
            expect(fetched.data.hacked).toBeUndefined();

            // Verify evault2 has its own separate envelope
            const fetchedEvault2 = await client.fetchMetaEnvelope(id1, evault2.w3id);
            expect(fetchedEvault2.data.hacked).toBe("data");
            expect(fetchedEvault2.data.original).toBeUndefined();
        });

        it("should handle multiple operations across tenants", async () => {
            // Perform operations on evault1
            const id1a = await client.storeMetaEnvelope({
                w3id: evault1.w3id,
                schemaId: "MultiOp",
                data: { op: "1a" },
            });
            const id1b = await client.storeMetaEnvelope({
                w3id: evault1.w3id,
                schemaId: "MultiOp",
                data: { op: "1b" },
            });

            // Perform operations on evault2
            const id2a = await client.storeMetaEnvelope({
                w3id: evault2.w3id,
                schemaId: "MultiOp",
                data: { op: "2a" },
            });
            const id2b = await client.storeMetaEnvelope({
                w3id: evault2.w3id,
                schemaId: "MultiOp",
                data: { op: "2b" },
            });

            // Verify isolation
            const fetched1a = await client.fetchMetaEnvelope(id1a, evault1.w3id);
            expect(fetched1a.data.op).toBe("1a");

            const fetched2a = await client.fetchMetaEnvelope(id2a, evault2.w3id);
            expect(fetched2a.data.op).toBe("2a");

            // Cross-tenant access should fail
            await expect(
                client.fetchMetaEnvelope(id1a, evault2.w3id)
            ).rejects.toThrow();
            await expect(
                client.fetchMetaEnvelope(id2a, evault1.w3id)
            ).rejects.toThrow();
        });
    });

    describe("Client Lifecycle", () => {
        it("should reuse client across multiple eNames", async () => {
            const registryUrl = `http://localhost:${server.registryPort}`;
            const client = new EVaultClientClass(registryUrl, "test-platform");

            try {
                // Use with evault1
                const id1 = await client.storeMetaEnvelope({
                    w3id: evault1.w3id,
                    schemaId: "ClientReuse",
                    data: { tenant: 1 },
                });

                // Use with evault2
                const id2 = await client.storeMetaEnvelope({
                    w3id: evault2.w3id,
                    schemaId: "ClientReuse",
                    data: { tenant: 2 },
                });

                // Fetch from both
                const fetched1 = await client.fetchMetaEnvelope(id1, evault1.w3id);
                const fetched2 = await client.fetchMetaEnvelope(id2, evault2.w3id);

                expect(fetched1.data.tenant).toBe(1);
                expect(fetched2.data.tenant).toBe(2);
            } finally {
                client.dispose();
            }
        });

        it("should handle health checks", async () => {
            const registryUrl = `http://localhost:${server.registryPort}`;
            const client = new EVaultClientClass(registryUrl, "test-platform");

            try {
                // Store something to create a client connection
                await client.storeMetaEnvelope({
                    w3id: evault1.w3id,
                    schemaId: "HealthCheck",
                    data: { test: "data" },
                });

                // Check health status
                const healthStatus = client.getHealthStatus();
                expect(healthStatus).toBeDefined();
                expect(typeof healthStatus).toBe("object");
                
                // Should have entry for evault1
                const evault1Health = healthStatus[evault1.w3id];
                expect(evault1Health).toBeDefined();
                expect(evault1Health.endpoint).toBeDefined();
            } finally {
                client.dispose();
            }
        });

        it("should clear cache correctly", async () => {
            const registryUrl = `http://localhost:${server.registryPort}`;
            const client = new EVaultClientClass(registryUrl, "test-platform");

            try {
                // Store to create cached client
                await client.storeMetaEnvelope({
                    w3id: evault1.w3id,
                    schemaId: "CacheTest",
                    data: { test: "data" },
                });

                // Clear cache
                client.clearCache();

                // Should still work after cache clear
                const id = await client.storeMetaEnvelope({
                    w3id: evault1.w3id,
                    schemaId: "CacheTest2",
                    data: { test: "data2" },
                });

                expect(id).toBeDefined();
            } finally {
                client.dispose();
            }
        });

        it("should dispose resources correctly", async () => {
            const registryUrl = `http://localhost:${server.registryPort}`;
            const client = new EVaultClientClass(registryUrl, "test-platform");

            // Store something
            await client.storeMetaEnvelope({
                w3id: evault1.w3id,
                schemaId: "DisposeTest",
                data: { test: "data" },
            });

            // Dispose
            client.dispose();

            // Operations should fail after dispose
            await expect(
                client.storeMetaEnvelope({
                    w3id: evault1.w3id,
                    schemaId: "DisposeTest",
                    data: { test: "data" },
                })
            ).rejects.toThrow();
        });
    });

    describe("Error Handling", () => {
        let client: any;

        beforeAll(() => {
            const registryUrl = `http://localhost:${server.registryPort}`;
            client = new EVaultClientClass(registryUrl, "test-platform");
        });

        afterAll(() => {
            if (client) {
                client.dispose();
            }
        });

        it("should fail with invalid eName (non-existent)", async () => {
            const invalidW3id = "invalid-w3id-that-does-not-exist";

            await expect(
                client.storeMetaEnvelope({
                    w3id: invalidW3id,
                    schemaId: "InvalidTest",
                    data: { test: "data" },
                })
            ).rejects.toThrow();
        });

        it("should fail when fetching non-existent envelope", async () => {
            const nonExistentId = "non-existent-envelope-id";

            await expect(
                client.fetchMetaEnvelope(nonExistentId, evault1.w3id)
            ).rejects.toThrow();
        });

        it("should create envelope in-place when updating non-existent envelope", async () => {
            const nonExistentId = "non-existent-envelope-id";

            // updateMetaEnvelopeById on non-existent envelope creates it in-place
            await client.updateMetaEnvelopeById(nonExistentId, {
                w3id: evault1.w3id,
                schemaId: "UpdateTest",
                data: { test: "data" },
            });

            // Verify it was created
            const fetched = await client.fetchMetaEnvelope(nonExistentId, evault1.w3id);
            expect(fetched.data.test).toBe("data");
        });

        it("should maintain isolation when using different eName", async () => {
            // Store with evault1
            const id = await client.storeMetaEnvelope({
                w3id: evault1.w3id,
                schemaId: "WrongTenant",
                data: { original: "data" },
            });

            // Try to fetch with evault2's w3id - should fail (doesn't exist for evault2)
            await expect(
                client.fetchMetaEnvelope(id, evault2.w3id)
            ).rejects.toThrow();

            // Update with evault2's w3id creates separate envelope for evault2
            await client.updateMetaEnvelopeById(id, {
                w3id: evault2.w3id,
                schemaId: "WrongTenant",
                data: { hacked: "data" },
            });

            // Now fetch works for evault2 and shows its own data
            const fetchedEvault2 = await client.fetchMetaEnvelope(id, evault2.w3id);
            expect(fetchedEvault2.data.hacked).toBe("data");
            expect(fetchedEvault2.data.original).toBeUndefined();

            // Verify evault1's data is still intact
            const fetchedEvault1 = await client.fetchMetaEnvelope(id, evault1.w3id);
            expect(fetchedEvault1.data.original).toBe("data");
            expect(fetchedEvault1.data.hacked).toBeUndefined();
        });
    });

    describe("GET /logs endpoint", () => {
        it("should return paginated envelope operation logs after store", async () => {
            const envelopeId = await client.storeMetaEnvelope({
                w3id: evault1.w3id,
                schemaId: "LogsTest",
                data: { test: "logs-e2e" },
            });
            expect(envelopeId).toBeDefined();

            const logsUrl = new URL("/logs", evault1.uri).toString();
            const res = await fetch(logsUrl, {
                method: "GET",
                headers: { "X-ENAME": evault1.w3id },
            });
            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body).toHaveProperty("logs");
            expect(Array.isArray(body.logs)).toBe(true);
            expect(body).toHaveProperty("hasMore");
            expect(typeof body.hasMore).toBe("boolean");

            const createLog = body.logs.find(
                (l: any) =>
                    l.metaEnvelopeId === envelopeId && l.operation === "create",
            );
            expect(createLog).toBeDefined();
            expect(createLog.id).toBeDefined();
            expect(createLog.envelopeHash).toBeDefined();
            expect(createLog.timestamp).toBeDefined();
            expect(createLog.ontology).toBe("LogsTest");
        });

        it("should require X-ENAME and return 400 when missing", async () => {
            const logsUrl = new URL("/logs", evault1.uri).toString();
            const res = await fetch(logsUrl, { method: "GET" });
            expect(res.status).toBe(400);
            const body = await res.json();
            expect(body.error).toContain("X-ENAME");
        });
    });
});
