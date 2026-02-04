import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
    setupE2ETestServer,
    teardownE2ETestServer,
    provisionTestEVault,
    makeGraphQLRequest,
    type E2ETestServer,
    type ProvisionedEVault,
} from "../../test-utils/e2e-setup";

describe("Idiomatic GraphQL API", () => {
    let server: E2ETestServer;
    let evault: ProvisionedEVault;

    beforeAll(async () => {
        server = await setupE2ETestServer();
        evault = await provisionTestEVault(server);
    }, 120000);

    afterAll(async () => {
        await teardownE2ETestServer(server);
    });

    describe("createMetaEnvelope mutation", () => {
        it("should create a MetaEnvelope and return structured payload", async () => {
            const testData = {
                content: "Hello from idiomatic API!",
                authorId: "@test-author",
                createdAt: "2025-02-04T10:00:00Z",
            };
            const testOntology = "IdiomaticTestPost";

            const mutation = `
                mutation CreateMetaEnvelope($input: MetaEnvelopeInput!) {
                    createMetaEnvelope(input: $input) {
                        metaEnvelope {
                            id
                            ontology
                            parsed
                            envelopes {
                                id
                                fieldKey
                                value
                                valueType
                            }
                        }
                        errors {
                            field
                            message
                            code
                        }
                    }
                }
            `;

            const result = await makeGraphQLRequest(server, mutation, {
                input: {
                    ontology: testOntology,
                    payload: testData,
                    acl: ["*"],
                },
            }, {
                "X-ENAME": evault.w3id,
            });

            expect(result.createMetaEnvelope).toBeDefined();
            expect(result.createMetaEnvelope.errors).toEqual([]);
            expect(result.createMetaEnvelope.metaEnvelope).toBeDefined();
            expect(result.createMetaEnvelope.metaEnvelope.id).toBeDefined();
            expect(result.createMetaEnvelope.metaEnvelope.ontology).toBe(testOntology);
            expect(result.createMetaEnvelope.metaEnvelope.parsed).toEqual(testData);

            // Verify envelopes have fieldKey
            const envelopes = result.createMetaEnvelope.metaEnvelope.envelopes;
            expect(envelopes.length).toBe(3);
            
            const contentEnvelope = envelopes.find((e: { fieldKey: string; value: string }) => e.fieldKey === "content");
            expect(contentEnvelope).toBeDefined();
            expect(contentEnvelope.value).toBe(testData.content);
        });

        it("should return errors when X-ENAME is missing", async () => {
            const mutation = `
                mutation CreateMetaEnvelope($input: MetaEnvelopeInput!) {
                    createMetaEnvelope(input: $input) {
                        metaEnvelope {
                            id
                        }
                        errors {
                            message
                            code
                        }
                    }
                }
            `;

            const result = await makeGraphQLRequest(server, mutation, {
                input: {
                    ontology: "TestOntology",
                    payload: { test: "data" },
                    acl: ["*"],
                },
            }, {
                // No X-ENAME header
            });

            expect(result.createMetaEnvelope.metaEnvelope).toBeNull();
            expect(result.createMetaEnvelope.errors.length).toBeGreaterThan(0);
            expect(result.createMetaEnvelope.errors[0].code).toBe("MISSING_ENAME");
        });
    });

    describe("metaEnvelope query", () => {
        let createdId: string;

        beforeAll(async () => {
            // Create a test envelope first
            const mutation = `
                mutation CreateMetaEnvelope($input: MetaEnvelopeInput!) {
                    createMetaEnvelope(input: $input) {
                        metaEnvelope {
                            id
                        }
                    }
                }
            `;

            const result = await makeGraphQLRequest(server, mutation, {
                input: {
                    ontology: "QueryTestOntology",
                    payload: { title: "Query Test", body: "Test body content" },
                    acl: ["*"],
                },
            }, {
                "X-ENAME": evault.w3id,
            });

            createdId = result.createMetaEnvelope.metaEnvelope.id;
        });

        it("should retrieve a MetaEnvelope by ID", async () => {
            const query = `
                query MetaEnvelope($id: ID!) {
                    metaEnvelope(id: $id) {
                        id
                        ontology
                        parsed
                        envelopes {
                            id
                            fieldKey
                            value
                        }
                    }
                }
            `;

            const result = await makeGraphQLRequest(server, query, {
                id: createdId,
            }, {
                "X-ENAME": evault.w3id,
            });

            expect(result.metaEnvelope).toBeDefined();
            expect(result.metaEnvelope.id).toBe(createdId);
            expect(result.metaEnvelope.ontology).toBe("QueryTestOntology");
            expect(result.metaEnvelope.parsed.title).toBe("Query Test");
            expect(result.metaEnvelope.parsed.body).toBe("Test body content");
        });

        it("should return null for non-existent ID", async () => {
            const query = `
                query MetaEnvelope($id: ID!) {
                    metaEnvelope(id: $id) {
                        id
                    }
                }
            `;

            const result = await makeGraphQLRequest(server, query, {
                id: "non-existent-id-12345",
            }, {
                "X-ENAME": evault.w3id,
            });

            expect(result.metaEnvelope).toBeNull();
        });
    });

    describe("metaEnvelopes query with pagination", () => {
        const testOntology = "PaginationTestOntology";

        beforeAll(async () => {
            // Create multiple test envelopes for pagination testing
            const mutation = `
                mutation CreateMetaEnvelope($input: MetaEnvelopeInput!) {
                    createMetaEnvelope(input: $input) {
                        metaEnvelope {
                            id
                        }
                    }
                }
            `;

            for (let i = 0; i < 5; i++) {
                await makeGraphQLRequest(server, mutation, {
                    input: {
                        ontology: testOntology,
                        payload: { index: i, content: `Test content ${i}` },
                        acl: ["*"],
                    },
                }, {
                    "X-ENAME": evault.w3id,
                });
            }
        });

        it("should return paginated results with pageInfo", async () => {
            const query = `
                query MetaEnvelopes($filter: MetaEnvelopeFilterInput, $first: Int) {
                    metaEnvelopes(filter: $filter, first: $first) {
                        edges {
                            cursor
                            node {
                                id
                                ontology
                                parsed
                            }
                        }
                        pageInfo {
                            hasNextPage
                            hasPreviousPage
                            startCursor
                            endCursor
                        }
                        totalCount
                    }
                }
            `;

            const result = await makeGraphQLRequest(server, query, {
                filter: { ontologyId: testOntology },
                first: 3,
            }, {
                "X-ENAME": evault.w3id,
            });

            expect(result.metaEnvelopes).toBeDefined();
            expect(result.metaEnvelopes.edges.length).toBe(3);
            expect(result.metaEnvelopes.totalCount).toBe(5);
            expect(result.metaEnvelopes.pageInfo.hasNextPage).toBe(true);
            expect(result.metaEnvelopes.pageInfo.startCursor).toBeDefined();
            expect(result.metaEnvelopes.pageInfo.endCursor).toBeDefined();

            // Each edge should have a cursor and node
            for (const edge of result.metaEnvelopes.edges) {
                expect(edge.cursor).toBeDefined();
                expect(edge.node.id).toBeDefined();
                expect(edge.node.ontology).toBe(testOntology);
            }
        });

        it("should support cursor-based pagination with after", async () => {
            const query = `
                query MetaEnvelopes($filter: MetaEnvelopeFilterInput, $first: Int, $after: String) {
                    metaEnvelopes(filter: $filter, first: $first, after: $after) {
                        edges {
                            cursor
                            node {
                                id
                                parsed
                            }
                        }
                        pageInfo {
                            hasNextPage
                            hasPreviousPage
                        }
                    }
                }
            `;

            // First page
            const firstPage = await makeGraphQLRequest(server, query, {
                filter: { ontologyId: testOntology },
                first: 2,
            }, {
                "X-ENAME": evault.w3id,
            });

            expect(firstPage.metaEnvelopes.edges.length).toBe(2);
            const endCursor = firstPage.metaEnvelopes.edges[1].cursor;

            // Second page using cursor
            const secondPage = await makeGraphQLRequest(server, query, {
                filter: { ontologyId: testOntology },
                first: 2,
                after: endCursor,
            }, {
                "X-ENAME": evault.w3id,
            });

            expect(secondPage.metaEnvelopes.edges.length).toBe(2);
            expect(secondPage.metaEnvelopes.pageInfo.hasPreviousPage).toBe(true);

            // Verify different items on each page
            const firstPageIds = firstPage.metaEnvelopes.edges.map((e: { node: { id: string } }) => e.node.id);
            const secondPageIds = secondPage.metaEnvelopes.edges.map((e: { node: { id: string } }) => e.node.id);
            
            for (const id of secondPageIds) {
                expect(firstPageIds).not.toContain(id);
            }
        });

        it("should filter by ontologyId", async () => {
            const query = `
                query MetaEnvelopes($filter: MetaEnvelopeFilterInput) {
                    metaEnvelopes(filter: $filter, first: 100) {
                        edges {
                            node {
                                ontology
                            }
                        }
                        totalCount
                    }
                }
            `;

            const result = await makeGraphQLRequest(server, query, {
                filter: { ontologyId: testOntology },
            }, {
                "X-ENAME": evault.w3id,
            });

            // All results should have the filtered ontology
            for (const edge of result.metaEnvelopes.edges) {
                expect(edge.node.ontology).toBe(testOntology);
            }
        });
    });

    describe("metaEnvelopes query with search", () => {
        const searchOntology = "SearchTestOntology";

        beforeAll(async () => {
            const mutation = `
                mutation CreateMetaEnvelope($input: MetaEnvelopeInput!) {
                    createMetaEnvelope(input: $input) {
                        metaEnvelope { id }
                    }
                }
            `;

            // Create test data with searchable content
            const testItems = [
                { title: "Hello World", content: "This is a test post" },
                { title: "Goodbye World", content: "Another test content" },
                { title: "Hello Again", content: "More hello content here" },
                { title: "Unrelated", content: "Nothing special" },
            ];

            for (const item of testItems) {
                await makeGraphQLRequest(server, mutation, {
                    input: {
                        ontology: searchOntology,
                        payload: item,
                        acl: ["*"],
                    },
                }, {
                    "X-ENAME": evault.w3id,
                });
            }
        });

        it("should search with CONTAINS mode (case-insensitive by default)", async () => {
            const query = `
                query MetaEnvelopes($filter: MetaEnvelopeFilterInput) {
                    metaEnvelopes(filter: $filter, first: 10) {
                        edges {
                            node {
                                parsed
                            }
                        }
                        totalCount
                    }
                }
            `;

            const result = await makeGraphQLRequest(server, query, {
                filter: {
                    ontologyId: searchOntology,
                    search: {
                        term: "hello",
                        mode: "CONTAINS",
                    },
                },
            }, {
                "X-ENAME": evault.w3id,
            });

            expect(result.metaEnvelopes.totalCount).toBeGreaterThanOrEqual(2);
            
            // All results should contain "hello" somewhere
            for (const edge of result.metaEnvelopes.edges) {
                const parsed = edge.node.parsed;
                const hasHello = 
                    parsed.title?.toLowerCase().includes("hello") ||
                    parsed.content?.toLowerCase().includes("hello");
                expect(hasHello).toBe(true);
            }
        });

        it("should search within specific fields", async () => {
            const query = `
                query MetaEnvelopes($filter: MetaEnvelopeFilterInput) {
                    metaEnvelopes(filter: $filter, first: 10) {
                        edges {
                            node {
                                parsed
                            }
                        }
                        totalCount
                    }
                }
            `;

            const result = await makeGraphQLRequest(server, query, {
                filter: {
                    ontologyId: searchOntology,
                    search: {
                        term: "hello",
                        fields: ["title"],
                    },
                },
            }, {
                "X-ENAME": evault.w3id,
            });

            // Should find "Hello World" and "Hello Again" but not the one with "hello" only in content
            expect(result.metaEnvelopes.totalCount).toBeGreaterThanOrEqual(2);
        });
    });

    describe("updateMetaEnvelope mutation", () => {
        let envelopeId: string;

        beforeAll(async () => {
            const mutation = `
                mutation CreateMetaEnvelope($input: MetaEnvelopeInput!) {
                    createMetaEnvelope(input: $input) {
                        metaEnvelope { id }
                    }
                }
            `;

            const result = await makeGraphQLRequest(server, mutation, {
                input: {
                    ontology: "UpdateTestOntology",
                    payload: { title: "Original Title", count: 0 },
                    acl: ["*"],
                },
            }, {
                "X-ENAME": evault.w3id,
            });

            envelopeId = result.createMetaEnvelope.metaEnvelope.id;
        });

        it("should update a MetaEnvelope and return structured payload", async () => {
            const mutation = `
                mutation UpdateMetaEnvelope($id: ID!, $input: MetaEnvelopeInput!) {
                    updateMetaEnvelope(id: $id, input: $input) {
                        metaEnvelope {
                            id
                            ontology
                            parsed
                        }
                        errors {
                            message
                            code
                        }
                    }
                }
            `;

            const updatedData = { title: "Updated Title", count: 42, newField: "added" };

            const result = await makeGraphQLRequest(server, mutation, {
                id: envelopeId,
                input: {
                    ontology: "UpdateTestOntology",
                    payload: updatedData,
                    acl: ["*"],
                },
            }, {
                "X-ENAME": evault.w3id,
            });

            expect(result.updateMetaEnvelope.errors).toEqual([]);
            expect(result.updateMetaEnvelope.metaEnvelope.id).toBe(envelopeId);
            expect(result.updateMetaEnvelope.metaEnvelope.parsed).toEqual(updatedData);
        });

        it("should return errors when X-ENAME is missing", async () => {
            const mutation = `
                mutation UpdateMetaEnvelope($id: ID!, $input: MetaEnvelopeInput!) {
                    updateMetaEnvelope(id: $id, input: $input) {
                        metaEnvelope { id }
                        errors { message code }
                    }
                }
            `;

            const result = await makeGraphQLRequest(server, mutation, {
                id: envelopeId,
                input: {
                    ontology: "TestOntology",
                    payload: { test: "data" },
                    acl: ["*"],
                },
            }, {
                // No X-ENAME header
            });

            expect(result.updateMetaEnvelope.metaEnvelope).toBeNull();
            expect(result.updateMetaEnvelope.errors[0].code).toBe("MISSING_ENAME");
        });
    });

    describe("removeMetaEnvelope mutation", () => {
        let envelopeId: string;

        beforeAll(async () => {
            const mutation = `
                mutation CreateMetaEnvelope($input: MetaEnvelopeInput!) {
                    createMetaEnvelope(input: $input) {
                        metaEnvelope { id }
                    }
                }
            `;

            const result = await makeGraphQLRequest(server, mutation, {
                input: {
                    ontology: "DeleteTestOntology",
                    payload: { toBeDeleted: true },
                    acl: ["*"],
                },
            }, {
                "X-ENAME": evault.w3id,
            });

            envelopeId = result.createMetaEnvelope.metaEnvelope.id;
        });

        it("should delete a MetaEnvelope and return structured result", async () => {
            const mutation = `
                mutation RemoveMetaEnvelope($id: ID!) {
                    removeMetaEnvelope(id: $id) {
                        deletedId
                        success
                        errors {
                            message
                            code
                        }
                    }
                }
            `;

            const result = await makeGraphQLRequest(server, mutation, {
                id: envelopeId,
            }, {
                "X-ENAME": evault.w3id,
            });

            expect(result.removeMetaEnvelope.deletedId).toBe(envelopeId);
            expect(result.removeMetaEnvelope.success).toBe(true);
            expect(result.removeMetaEnvelope.errors).toEqual([]);

            // Verify it's actually deleted
            const query = `
                query MetaEnvelope($id: ID!) {
                    metaEnvelope(id: $id) { id }
                }
            `;

            const queryResult = await makeGraphQLRequest(server, query, {
                id: envelopeId,
            }, {
                "X-ENAME": evault.w3id,
            });

            expect(queryResult.metaEnvelope).toBeNull();
        });

        it("should return error for non-existent ID", async () => {
            const mutation = `
                mutation RemoveMetaEnvelope($id: ID!) {
                    removeMetaEnvelope(id: $id) {
                        deletedId
                        success
                        errors { message code }
                    }
                }
            `;

            const result = await makeGraphQLRequest(server, mutation, {
                id: "non-existent-id-99999",
            }, {
                "X-ENAME": evault.w3id,
            });

            expect(result.removeMetaEnvelope.success).toBe(false);
            expect(result.removeMetaEnvelope.errors[0].code).toBe("NOT_FOUND");
        });

        it("should return error when X-ENAME is missing", async () => {
            const mutation = `
                mutation RemoveMetaEnvelope($id: ID!) {
                    removeMetaEnvelope(id: $id) {
                        deletedId
                        success
                        errors { message code }
                    }
                }
            `;

            const result = await makeGraphQLRequest(server, mutation, {
                id: "any-id",
            }, {
                // No X-ENAME header
            });

            expect(result.removeMetaEnvelope.success).toBe(false);
            expect(result.removeMetaEnvelope.errors[0].code).toBe("MISSING_ENAME");
        });
    });

    describe("Envelope.fieldKey resolver", () => {
        it("should return fieldKey as alias for ontology", async () => {
            const mutation = `
                mutation CreateMetaEnvelope($input: MetaEnvelopeInput!) {
                    createMetaEnvelope(input: $input) {
                        metaEnvelope {
                            envelopes {
                                ontology
                                fieldKey
                            }
                        }
                    }
                }
            `;

            const result = await makeGraphQLRequest(server, mutation, {
                input: {
                    ontology: "FieldKeyTestOntology",
                    payload: { 
                        testField: "value1",
                        anotherField: "value2",
                    },
                    acl: ["*"],
                },
            }, {
                "X-ENAME": evault.w3id,
            });

            const envelopes = result.createMetaEnvelope.metaEnvelope.envelopes;
            
            // Each envelope should have matching ontology and fieldKey
            for (const envelope of envelopes) {
                expect(envelope.fieldKey).toBe(envelope.ontology);
            }

            // Verify specific field keys exist
            const fieldKeys = envelopes.map((e: { fieldKey: string }) => e.fieldKey);
            expect(fieldKeys).toContain("testField");
            expect(fieldKeys).toContain("anotherField");
        });
    });

    describe("backward compatibility", () => {
        it("legacy storeMetaEnvelope should still work", async () => {
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

            const result = await makeGraphQLRequest(server, mutation, {
                input: {
                    ontology: "LegacyTestOntology",
                    payload: { legacyField: "legacy value" },
                    acl: ["*"],
                },
            }, {
                "X-ENAME": evault.w3id,
            });

            expect(result.storeMetaEnvelope.metaEnvelope.id).toBeDefined();
            expect(result.storeMetaEnvelope.metaEnvelope.ontology).toBe("LegacyTestOntology");
            expect(result.storeMetaEnvelope.envelopes.length).toBe(1);
        });

        it("legacy getMetaEnvelopeById should still work", async () => {
            // First create an envelope
            const createResult = await makeGraphQLRequest(server, `
                mutation StoreMetaEnvelope($input: MetaEnvelopeInput!) {
                    storeMetaEnvelope(input: $input) {
                        metaEnvelope { id }
                    }
                }
            `, {
                input: {
                    ontology: "LegacyQueryTest",
                    payload: { test: "data" },
                    acl: ["*"],
                },
            }, {
                "X-ENAME": evault.w3id,
            });

            const id = createResult.storeMetaEnvelope.metaEnvelope.id;

            // Query using legacy endpoint
            const query = `
                query GetMetaEnvelopeById($id: String!) {
                    getMetaEnvelopeById(id: $id) {
                        id
                        ontology
                        parsed
                    }
                }
            `;

            const result = await makeGraphQLRequest(server, query, {
                id,
            }, {
                "X-ENAME": evault.w3id,
            });

            expect(result.getMetaEnvelopeById.id).toBe(id);
            expect(result.getMetaEnvelopeById.ontology).toBe("LegacyQueryTest");
        });

        it("legacy deleteMetaEnvelope should still work", async () => {
            // First create an envelope
            const createResult = await makeGraphQLRequest(server, `
                mutation StoreMetaEnvelope($input: MetaEnvelopeInput!) {
                    storeMetaEnvelope(input: $input) {
                        metaEnvelope { id }
                    }
                }
            `, {
                input: {
                    ontology: "LegacyDeleteTest",
                    payload: { toDelete: true },
                    acl: ["*"],
                },
            }, {
                "X-ENAME": evault.w3id,
            });

            const id = createResult.storeMetaEnvelope.metaEnvelope.id;

            // Delete using legacy endpoint
            const mutation = `
                mutation DeleteMetaEnvelope($id: String!) {
                    deleteMetaEnvelope(id: $id)
                }
            `;

            const result = await makeGraphQLRequest(server, mutation, {
                id,
            }, {
                "X-ENAME": evault.w3id,
            });

            expect(result.deleteMetaEnvelope).toBe(true);
        });
    });
});
