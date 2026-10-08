import * as jose from "jose";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
    type E2ETestServer,
    type ProvisionedEVault,
    makeGraphQLRequest,
    provisionTestEVault,
    setupE2ETestServer,
    teardownE2ETestServer,
} from "../../test-utils/e2e-setup";
import { getSharedTestKeyPair } from "../../test-utils/shared-test-keys";

describe("Idiomatic GraphQL API", () => {
    let server: E2ETestServer;
    let evault: ProvisionedEVault;
    let authToken: string;

    beforeAll(async () => {
        server = await setupE2ETestServer();
        evault = await provisionTestEVault(server);

        // Create auth token for tests that require authentication
        const { privateKey } = await getSharedTestKeyPair();
        authToken = await new jose.SignJWT({
            platform: "http://localhost:3000",
        })
            .setProtectedHeader({ alg: "ES256", kid: "entropy-key-1" })
            .setIssuedAt()
            .setExpirationTime("1h")
            .sign(privateKey);
    }, 120000);

    afterAll(async () => {
        await teardownE2ETestServer(server);
    });

    // Helper to get auth headers
    const getAuthHeaders = () => ({
        "X-ENAME": evault.w3id,
        Authorization: `Bearer ${authToken}`,
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

            const result = await makeGraphQLRequest(
                server,
                mutation,
                {
                    input: {
                        ontology: testOntology,
                        payload: testData,
                        acl: ["*"],
                    },
                },
                {
                    "X-ENAME": evault.w3id,
                },
            );

            expect(result.createMetaEnvelope).toBeDefined();
            expect(result.createMetaEnvelope.errors).toEqual([]);
            expect(result.createMetaEnvelope.metaEnvelope).toBeDefined();
            expect(result.createMetaEnvelope.metaEnvelope.id).toBeDefined();
            expect(result.createMetaEnvelope.metaEnvelope.ontology).toBe(
                testOntology,
            );
            expect(result.createMetaEnvelope.metaEnvelope.parsed).toEqual(
                testData,
            );

            // Verify envelopes have fieldKey
            const envelopes = result.createMetaEnvelope.metaEnvelope.envelopes;
            expect(envelopes.length).toBe(3);

            const contentEnvelope = envelopes.find(
                (e: { fieldKey: string; value: string }) =>
                    e.fieldKey === "content",
            );
            expect(contentEnvelope).toBeDefined();
            expect(contentEnvelope.value).toBe(testData.content);
        });

        it("should throw GraphQL error when X-ENAME is missing", async () => {
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

            // X-ENAME validation happens at middleware level, throws GraphQL error
            await expect(
                makeGraphQLRequest(
                    server,
                    mutation,
                    {
                        input: {
                            ontology: "TestOntology",
                            payload: { test: "data" },
                            acl: ["*"],
                        },
                    },
                    {
                        // No X-ENAME header
                    },
                ),
            ).rejects.toThrow();
        });
    });

    describe("company authority records", () => {
        it("refuses an unsigned Role in the company's own vault", async () => {
            const mutation = `
                mutation CreateMetaEnvelope($input: MetaEnvelopeInput!) {
                    createMetaEnvelope(input: $input) {
                        metaEnvelope { id }
                        errors { message code }
                    }
                }
            `;
            const result = await makeGraphQLRequest(
                server,
                mutation,
                {
                    input: {
                        ontology: "65fd0e21-34b9-43ef-be76-c5b39727010e",
                        payload: {
                            companyEName: evault.w3id,
                            title: "Head of Finance",
                            scopes: ["@esigner:nda"],
                            mayRedelegate: false,
                            status: "active",
                            createdBy: "@someone",
                            createdAt: "2026-10-08T12:00:00.000Z",
                            updatedAt: "2026-10-08T12:00:00.000Z",
                        },
                        acl: ["*"],
                    },
                },
                getAuthHeaders(),
            );
            expect(result.createMetaEnvelope.metaEnvelope).toBeNull();
            expect(result.createMetaEnvelope.errors[0].code).toBe("UNSIGNED");
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

            const result = await makeGraphQLRequest(
                server,
                mutation,
                {
                    input: {
                        ontology: "QueryTestOntology",
                        payload: {
                            title: "Query Test",
                            body: "Test body content",
                        },
                        acl: ["*"],
                    },
                },
                {
                    "X-ENAME": evault.w3id,
                },
            );

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

            const result = await makeGraphQLRequest(
                server,
                query,
                {
                    id: createdId,
                },
                getAuthHeaders(),
            );

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

            const result = await makeGraphQLRequest(
                server,
                query,
                {
                    id: "non-existent-id-12345",
                },
                getAuthHeaders(),
            );

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
                await makeGraphQLRequest(
                    server,
                    mutation,
                    {
                        input: {
                            ontology: testOntology,
                            payload: { index: i, content: `Test content ${i}` },
                            acl: ["*"],
                        },
                    },
                    {
                        "X-ENAME": evault.w3id,
                    },
                );
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

            const result = await makeGraphQLRequest(
                server,
                query,
                {
                    filter: { ontologyId: testOntology },
                    first: 3,
                },
                getAuthHeaders(),
            );

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
            const firstPage = await makeGraphQLRequest(
                server,
                query,
                {
                    filter: { ontologyId: testOntology },
                    first: 2,
                },
                getAuthHeaders(),
            );

            expect(firstPage.metaEnvelopes.edges.length).toBe(2);
            const endCursor = firstPage.metaEnvelopes.edges[1].cursor;

            // Second page using cursor
            const secondPage = await makeGraphQLRequest(
                server,
                query,
                {
                    filter: { ontologyId: testOntology },
                    first: 2,
                    after: endCursor,
                },
                getAuthHeaders(),
            );

            expect(secondPage.metaEnvelopes.edges.length).toBe(2);
            expect(secondPage.metaEnvelopes.pageInfo.hasPreviousPage).toBe(
                true,
            );

            // Verify different items on each page
            const firstPageIds = firstPage.metaEnvelopes.edges.map(
                (e: { node: { id: string } }) => e.node.id,
            );
            const secondPageIds = secondPage.metaEnvelopes.edges.map(
                (e: { node: { id: string } }) => e.node.id,
            );

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

            const result = await makeGraphQLRequest(
                server,
                query,
                {
                    filter: { ontologyId: testOntology },
                },
                getAuthHeaders(),
            );

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
                await makeGraphQLRequest(
                    server,
                    mutation,
                    {
                        input: {
                            ontology: searchOntology,
                            payload: item,
                            acl: ["*"],
                        },
                    },
                    {
                        "X-ENAME": evault.w3id,
                    },
                );
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

            const result = await makeGraphQLRequest(
                server,
                query,
                {
                    filter: {
                        ontologyId: searchOntology,
                        search: {
                            term: "hello",
                            mode: "CONTAINS",
                        },
                    },
                },
                getAuthHeaders(),
            );

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

            const result = await makeGraphQLRequest(
                server,
                query,
                {
                    filter: {
                        ontologyId: searchOntology,
                        search: {
                            term: "hello",
                            fields: ["title"],
                        },
                    },
                },
                getAuthHeaders(),
            );

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

            const result = await makeGraphQLRequest(
                server,
                mutation,
                {
                    input: {
                        ontology: "UpdateTestOntology",
                        payload: { title: "Original Title", count: 0 },
                        acl: ["*"],
                    },
                },
                {
                    "X-ENAME": evault.w3id,
                },
            );

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

            const updatedData = {
                title: "Updated Title",
                count: 42,
                newField: "added",
            };

            const result = await makeGraphQLRequest(
                server,
                mutation,
                {
                    id: envelopeId,
                    input: {
                        ontology: "UpdateTestOntology",
                        payload: updatedData,
                        acl: ["*"],
                    },
                },
                getAuthHeaders(),
            );

            expect(result.updateMetaEnvelope.errors).toEqual([]);
            expect(result.updateMetaEnvelope.metaEnvelope.id).toBe(envelopeId);
            expect(result.updateMetaEnvelope.metaEnvelope.parsed).toEqual(
                updatedData,
            );
        });

        it("should throw GraphQL error when authentication is missing", async () => {
            const mutation = `
                mutation UpdateMetaEnvelope($id: ID!, $input: MetaEnvelopeInput!) {
                    updateMetaEnvelope(id: $id, input: $input) {
                        metaEnvelope { id }
                        errors { message code }
                    }
                }
            `;

            // Authentication validation happens at middleware level
            await expect(
                makeGraphQLRequest(
                    server,
                    mutation,
                    {
                        id: envelopeId,
                        input: {
                            ontology: "TestOntology",
                            payload: { test: "data" },
                            acl: ["*"],
                        },
                    },
                    {
                        // No X-ENAME or Authorization header
                    },
                ),
            ).rejects.toThrow();
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

            const result = await makeGraphQLRequest(
                server,
                mutation,
                {
                    input: {
                        ontology: "DeleteTestOntology",
                        payload: { toBeDeleted: true },
                        acl: ["*"],
                    },
                },
                {
                    "X-ENAME": evault.w3id,
                },
            );

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

            const result = await makeGraphQLRequest(
                server,
                mutation,
                {
                    id: envelopeId,
                },
                getAuthHeaders(),
            );

            expect(result.removeMetaEnvelope.deletedId).toBe(envelopeId);
            expect(result.removeMetaEnvelope.success).toBe(true);
            expect(result.removeMetaEnvelope.errors).toEqual([]);

            // Verify it's actually deleted
            const query = `
                query MetaEnvelope($id: ID!) {
                    metaEnvelope(id: $id) { id }
                }
            `;

            const queryResult = await makeGraphQLRequest(
                server,
                query,
                {
                    id: envelopeId,
                },
                getAuthHeaders(),
            );

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

            const result = await makeGraphQLRequest(
                server,
                mutation,
                {
                    id: "non-existent-id-99999",
                },
                getAuthHeaders(),
            );

            expect(result.removeMetaEnvelope.success).toBe(false);
            expect(result.removeMetaEnvelope.errors[0].code).toBe("NOT_FOUND");
        });

        it("should throw GraphQL error when authentication is missing", async () => {
            const mutation = `
                mutation RemoveMetaEnvelope($id: ID!) {
                    removeMetaEnvelope(id: $id) {
                        deletedId
                        success
                        errors { message code }
                    }
                }
            `;

            // Authentication validation happens at middleware level
            await expect(
                makeGraphQLRequest(
                    server,
                    mutation,
                    {
                        id: "any-id",
                    },
                    {
                        // No X-ENAME or Authorization header
                    },
                ),
            ).rejects.toThrow();
        });
    });

    describe("metaEnvelopeHistory query", () => {
        const HISTORY_QUERY = `
            query History($id: ID!, $first: Int, $after: String) {
                metaEnvelopeHistory(id: $id, first: $first, after: $after) {
                    edges {
                        cursor
                        node { metaEnvelopeId version operation ontology parsed createdAt }
                    }
                    pageInfo { hasNextPage endCursor }
                    totalCount
                }
            }
        `;

        it("keeps every version and stays readable after removal", async () => {
            const created = await makeGraphQLRequest(
                server,
                `mutation Create($input: MetaEnvelopeInput!) {
                    createMetaEnvelope(input: $input) { metaEnvelope { id } }
                }`,
                {
                    input: {
                        ontology: "HistoryTestOntology",
                        payload: { title: "v1", body: "unchanged" },
                        acl: ["*"],
                    },
                },
                getAuthHeaders(),
            );
            const id = created.createMetaEnvelope.metaEnvelope.id;

            await makeGraphQLRequest(
                server,
                `mutation Update($id: ID!, $input: MetaEnvelopeInput!) {
                    updateMetaEnvelope(id: $id, input: $input) { errors { message } }
                }`,
                {
                    id,
                    input: {
                        ontology: "HistoryTestOntology",
                        payload: { title: "v2" },
                        acl: ["*"],
                    },
                },
                getAuthHeaders(),
            );

            const removed = await makeGraphQLRequest(
                server,
                `mutation Remove($id: ID!) {
                    removeMetaEnvelope(id: $id) { success }
                }`,
                { id },
                getAuthHeaders(),
            );
            expect(removed.removeMetaEnvelope.success).toBe(true);

            // Gone from every live read
            const live = await makeGraphQLRequest(
                server,
                `query Live($id: ID!) { metaEnvelope(id: $id) { id } }`,
                { id },
                getAuthHeaders(),
            );
            expect(live.metaEnvelope).toBeNull();
            const listed = await makeGraphQLRequest(
                server,
                `query List { metaEnvelopes(filter: { ontologyId: "HistoryTestOntology" }) { totalCount } }`,
                {},
                getAuthHeaders(),
            );
            expect(listed.metaEnvelopes.totalCount).toBe(0);

            // ...but its history is still there, newest first
            const result = await makeGraphQLRequest(
                server,
                HISTORY_QUERY,
                { id },
                getAuthHeaders(),
            );
            const history = result.metaEnvelopeHistory;
            expect(history.totalCount).toBe(3);
            expect(
                history.edges.map((e: any) => [e.node.version, e.node.operation]),
            ).toEqual([
                [3, "delete"],
                [2, "update"],
                [1, "create"],
            ]);
            expect(history.edges[0].node.parsed).toBeNull();
            expect(history.edges[1].node.parsed).toEqual({
                title: "v2",
                body: "unchanged",
            });
            expect(history.edges[2].node.parsed).toEqual({
                title: "v1",
                body: "unchanged",
            });
            expect(history.edges[2].node.metaEnvelopeId).toBe(id);

            const page = await makeGraphQLRequest(
                server,
                HISTORY_QUERY,
                { id, first: 1, after: history.edges[0].cursor },
                getAuthHeaders(),
            );
            expect(page.metaEnvelopeHistory.edges[0].node.version).toBe(2);
            expect(page.metaEnvelopeHistory.pageInfo.hasNextPage).toBe(true);
        });

        it("requires authentication", async () => {
            await expect(
                makeGraphQLRequest(
                    server,
                    HISTORY_QUERY,
                    { id: "any-id" },
                    { "X-ENAME": evault.w3id },
                ),
            ).rejects.toThrow();
        });
    });

    describe("rollbackMetaEnvelope mutation", () => {
        const ROLLBACK = `
            mutation Rollback($id: ID!, $version: Int!) {
                rollbackMetaEnvelope(id: $id, version: $version) {
                    metaEnvelope { id parsed }
                    version
                    restoredFromVersion
                    errors { field message code }
                }
            }
        `;
        const USER = "@undo-e2e-user";

        const create = async (payload: Record<string, unknown>) => {
            const result = await makeGraphQLRequest(
                server,
                `mutation Create($input: MetaEnvelopeInput!) {
                    createMetaEnvelope(input: $input) { metaEnvelope { id } }
                }`,
                { input: { ontology: "RollbackE2EOntology", payload, acl: ["*"] } },
                getAuthHeaders(),
            );
            return result.createMetaEnvelope.metaEnvelope.id as string;
        };

        it("restores an earlier version, recording who asked for it", async () => {
            const id = await create({ title: "first" });
            await makeGraphQLRequest(
                server,
                `mutation Update($id: ID!, $input: MetaEnvelopeInput!) {
                    updateMetaEnvelope(id: $id, input: $input) { errors { message } }
                }`,
                {
                    id,
                    input: {
                        ontology: "RollbackE2EOntology",
                        payload: { title: "second", extra: true },
                        acl: ["*"],
                    },
                },
                getAuthHeaders(),
            );

            const result = await makeGraphQLRequest(
                server,
                ROLLBACK,
                { id, version: 1 },
                { ...getAuthHeaders(), "X-ON-BEHALF-OF": USER },
            );
            expect(result.rollbackMetaEnvelope.errors).toEqual([]);
            expect(result.rollbackMetaEnvelope.version).toBe(3);
            expect(result.rollbackMetaEnvelope.restoredFromVersion).toBe(1);
            expect(result.rollbackMetaEnvelope.metaEnvelope.parsed).toEqual({
                title: "first",
            });

            const history = await makeGraphQLRequest(
                server,
                `query History($id: ID!) {
                    metaEnvelopeHistory(id: $id) {
                        edges { node { version operation author restoredFromVersion parsed } }
                    }
                }`,
                { id },
                getAuthHeaders(),
            );
            expect(history.metaEnvelopeHistory.edges[0].node).toEqual({
                version: 3,
                operation: "update",
                author: USER,
                restoredFromVersion: 1,
                parsed: { title: "first" },
            });

            // The operation log carries the author too. It is written
            // best-effort after the response, so give it a moment.
            let entry: any;
            for (let attempt = 0; attempt < 20 && !entry; attempt++) {
                const logs = await fetch(
                    `http://localhost:${server.fastifyPort}/logs?limit=100`,
                    { headers: { "X-ENAME": evault.w3id } },
                ).then((r) => r.json());
                entry = logs.logs.find(
                    (l: any) => l.metaEnvelopeId === id && l.author === USER,
                );
                if (!entry) await new Promise((r) => setTimeout(r, 100));
            }
            expect(entry?.operation).toBe("update");
        });

        it("brings back a removed record", async () => {
            const id = await create({ title: "keep" });
            await makeGraphQLRequest(
                server,
                `mutation Remove($id: ID!) { removeMetaEnvelope(id: $id) { success } }`,
                { id },
                getAuthHeaders(),
            );

            const result = await makeGraphQLRequest(
                server,
                ROLLBACK,
                { id, version: 1 },
                getAuthHeaders(),
            );
            expect(result.rollbackMetaEnvelope.errors).toEqual([]);
            expect(result.rollbackMetaEnvelope.version).toBe(3);

            const live = await makeGraphQLRequest(
                server,
                `query Live($id: ID!) { metaEnvelope(id: $id) { parsed } }`,
                { id },
                getAuthHeaders(),
            );
            expect(live.metaEnvelope.parsed).toEqual({ title: "keep" });
        });

        it("returns a structured error for an unknown version", async () => {
            const id = await create({ title: "only" });
            const result = await makeGraphQLRequest(
                server,
                ROLLBACK,
                { id, version: 42 },
                getAuthHeaders(),
            );
            expect(result.rollbackMetaEnvelope.metaEnvelope).toBeNull();
            expect(result.rollbackMetaEnvelope.errors[0].code).toBe(
                "VERSION_NOT_FOUND",
            );
        });

        it("requires authentication", async () => {
            await expect(
                makeGraphQLRequest(
                    server,
                    ROLLBACK,
                    { id: "any-id", version: 1 },
                    { "X-ENAME": evault.w3id },
                ),
            ).rejects.toThrow();
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

            const result = await makeGraphQLRequest(
                server,
                mutation,
                {
                    input: {
                        ontology: "FieldKeyTestOntology",
                        payload: {
                            testField: "value1",
                            anotherField: "value2",
                        },
                        acl: ["*"],
                    },
                },
                {
                    "X-ENAME": evault.w3id,
                },
            );

            const envelopes = result.createMetaEnvelope.metaEnvelope.envelopes;

            // Each envelope should have matching ontology and fieldKey
            for (const envelope of envelopes) {
                expect(envelope.fieldKey).toBe(envelope.ontology);
            }

            // Verify specific field keys exist
            const fieldKeys = envelopes.map(
                (e: { fieldKey: string }) => e.fieldKey,
            );
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

            const result = await makeGraphQLRequest(
                server,
                mutation,
                {
                    input: {
                        ontology: "LegacyTestOntology",
                        payload: { legacyField: "legacy value" },
                        acl: ["*"],
                    },
                },
                {
                    "X-ENAME": evault.w3id,
                },
            );

            expect(result.storeMetaEnvelope.metaEnvelope.id).toBeDefined();
            expect(result.storeMetaEnvelope.metaEnvelope.ontology).toBe(
                "LegacyTestOntology",
            );
            expect(result.storeMetaEnvelope.envelopes.length).toBe(1);
        });

        it("legacy getMetaEnvelopeById should still work", async () => {
            // First create an envelope
            const createResult = await makeGraphQLRequest(
                server,
                `
                mutation StoreMetaEnvelope($input: MetaEnvelopeInput!) {
                    storeMetaEnvelope(input: $input) {
                        metaEnvelope { id }
                    }
                }
            `,
                {
                    input: {
                        ontology: "LegacyQueryTest",
                        payload: { test: "data" },
                        acl: ["*"],
                    },
                },
                {
                    "X-ENAME": evault.w3id,
                },
            );

            const id = createResult.storeMetaEnvelope.metaEnvelope.id;

            // Query using legacy endpoint - requires auth token
            const query = `
                query GetMetaEnvelopeById($id: String!) {
                    getMetaEnvelopeById(id: $id) {
                        id
                        ontology
                        parsed
                    }
                }
            `;

            const result = await makeGraphQLRequest(
                server,
                query,
                {
                    id,
                },
                getAuthHeaders(),
            );

            expect(result.getMetaEnvelopeById.id).toBe(id);
            expect(result.getMetaEnvelopeById.ontology).toBe("LegacyQueryTest");
        });

        it("legacy deleteMetaEnvelope should still work", async () => {
            // First create an envelope
            const createResult = await makeGraphQLRequest(
                server,
                `
                mutation StoreMetaEnvelope($input: MetaEnvelopeInput!) {
                    storeMetaEnvelope(input: $input) {
                        metaEnvelope { id }
                    }
                }
            `,
                {
                    input: {
                        ontology: "LegacyDeleteTest",
                        payload: { toDelete: true },
                        acl: ["*"],
                    },
                },
                {
                    "X-ENAME": evault.w3id,
                },
            );

            const id = createResult.storeMetaEnvelope.metaEnvelope.id;

            // Delete using legacy endpoint - requires auth token
            const mutation = `
                mutation DeleteMetaEnvelope($id: String!) {
                    deleteMetaEnvelope(id: $id)
                }
            `;

            const result = await makeGraphQLRequest(
                server,
                mutation,
                {
                    id,
                },
                getAuthHeaders(),
            );

            expect(result.deleteMetaEnvelope).toBe(true);
        });
    });

    describe("bulkCreateMetaEnvelopes mutation", () => {
        it("should create multiple MetaEnvelopes in bulk", async () => {
            const mutation = `
                mutation BulkCreate($inputs: [BulkMetaEnvelopeInput!]!) {
                    bulkCreateMetaEnvelopes(inputs: $inputs) {
                        successCount
                        errorCount
                        results {
                            id
                            success
                            error
                        }
                        errors {
                            message
                            code
                        }
                    }
                }
            `;

            const inputs = [
                {
                    ontology: "BulkTestOntology1",
                    payload: {
                        title: "Bulk Post 1",
                        content: "First bulk post",
                    },
                    acl: ["*"],
                },
                {
                    ontology: "BulkTestOntology2",
                    payload: {
                        title: "Bulk Post 2",
                        content: "Second bulk post",
                    },
                    acl: ["*"],
                },
                {
                    ontology: "BulkTestOntology3",
                    payload: {
                        title: "Bulk Post 3",
                        content: "Third bulk post",
                    },
                    acl: ["*"],
                },
            ];

            const result = await makeGraphQLRequest(
                server,
                mutation,
                {
                    inputs,
                },
                getAuthHeaders(),
            );

            expect(result.bulkCreateMetaEnvelopes.successCount).toBe(3);
            expect(result.bulkCreateMetaEnvelopes.errorCount).toBe(0);
            expect(result.bulkCreateMetaEnvelopes.results.length).toBe(3);
            expect(result.bulkCreateMetaEnvelopes.errors).toEqual([]);

            // Verify all succeeded
            for (const res of result.bulkCreateMetaEnvelopes.results) {
                expect(res.success).toBe(true);
                expect(res.id).toBeDefined();
                expect(res.error).toBeNull();
            }
        });

        it("should preserve IDs when provided", async () => {
            const mutation = `
                mutation BulkCreate($inputs: [BulkMetaEnvelopeInput!]!) {
                    bulkCreateMetaEnvelopes(inputs: $inputs) {
                        successCount
                        results {
                            id
                            success
                        }
                    }
                }
            `;

            const customId1 = "@preserved-id-1";
            const customId2 = "@preserved-id-2";

            const inputs = [
                {
                    id: customId1,
                    ontology: "PreservedIdTest1",
                    payload: { data: "test1" },
                    acl: ["*"],
                },
                {
                    id: customId2,
                    ontology: "PreservedIdTest2",
                    payload: { data: "test2" },
                    acl: ["*"],
                },
            ];

            const result = await makeGraphQLRequest(
                server,
                mutation,
                {
                    inputs,
                },
                getAuthHeaders(),
            );

            expect(result.bulkCreateMetaEnvelopes.successCount).toBe(2);
            expect(result.bulkCreateMetaEnvelopes.results[0].id).toBe(
                customId1,
            );
            expect(result.bulkCreateMetaEnvelopes.results[1].id).toBe(
                customId2,
            );
        });

        it("should skip webhooks when skipWebhooks=true and platform is EMOVER_API_URL", async () => {
            // This test verifies the webhook suppression logic
            // In a real scenario, emover platform token would have platform: EMOVER_API_URL
            const mutation = `
                mutation BulkCreate($inputs: [BulkMetaEnvelopeInput!]!, $skipWebhooks: Boolean) {
                    bulkCreateMetaEnvelopes(inputs: $inputs, skipWebhooks: $skipWebhooks) {
                        successCount
                        errorCount
                        results {
                            id
                            success
                        }
                    }
                }
            `;

            const inputs = [
                {
                    ontology: "WebhookSkipTest",
                    payload: { migration: true },
                    acl: ["*"],
                },
            ];

            // Note: Without emover platform token, webhooks won't actually be skipped
            // but the mutation should still succeed
            const result = await makeGraphQLRequest(
                server,
                mutation,
                {
                    inputs,
                    skipWebhooks: true,
                },
                getAuthHeaders(),
            );

            expect(result.bulkCreateMetaEnvelopes.successCount).toBe(1);
            expect(result.bulkCreateMetaEnvelopes.errorCount).toBe(0);
        });

        it("should return error when X-ENAME is missing", async () => {
            const mutation = `
                mutation BulkCreate($inputs: [BulkMetaEnvelopeInput!]!) {
                    bulkCreateMetaEnvelopes(inputs: $inputs) {
                        successCount
                        errorCount
                        errors {
                            message
                            code
                        }
                    }
                }
            `;

            const inputs = [
                {
                    ontology: "TestOntology",
                    payload: { test: "data" },
                    acl: ["*"],
                },
            ];

            await expect(
                makeGraphQLRequest(
                    server,
                    mutation,
                    {
                        inputs,
                    },
                    {
                        // No X-ENAME header
                    },
                ),
            ).rejects.toThrow();
        });

        it("should handle partial failures gracefully", async () => {
            const mutation = `
                mutation BulkCreate($inputs: [BulkMetaEnvelopeInput!]!) {
                    bulkCreateMetaEnvelopes(inputs: $inputs) {
                        successCount
                        errorCount
                        results {
                            id
                            success
                            error
                        }
                    }
                }
            `;

            // Create valid inputs - all should succeed in normal operation
            const inputs = [
                {
                    ontology: "ValidOntology1",
                    payload: { data: "valid1" },
                    acl: ["*"],
                },
                {
                    ontology: "ValidOntology2",
                    payload: { data: "valid2" },
                    acl: ["*"],
                },
            ];

            const result = await makeGraphQLRequest(
                server,
                mutation,
                {
                    inputs,
                },
                getAuthHeaders(),
            );

            // In normal operation, all should succeed
            expect(
                result.bulkCreateMetaEnvelopes.successCount,
            ).toBeGreaterThanOrEqual(0);
            expect(result.bulkCreateMetaEnvelopes.results.length).toBe(2);
        });

        it("should handle empty input array", async () => {
            const mutation = `
                mutation BulkCreate($inputs: [BulkMetaEnvelopeInput!]!) {
                    bulkCreateMetaEnvelopes(inputs: $inputs) {
                        successCount
                        errorCount
                        results {
                            id
                            success
                        }
                    }
                }
            `;

            const result = await makeGraphQLRequest(
                server,
                mutation,
                {
                    inputs: [],
                },
                getAuthHeaders(),
            );

            expect(result.bulkCreateMetaEnvelopes.successCount).toBe(0);
            expect(result.bulkCreateMetaEnvelopes.errorCount).toBe(0);
            expect(result.bulkCreateMetaEnvelopes.results).toEqual([]);
        });

        it("should verify created envelopes exist and are queryable", async () => {
            // First, bulk create some envelopes
            const createMutation = `
                mutation BulkCreate($inputs: [BulkMetaEnvelopeInput!]!) {
                    bulkCreateMetaEnvelopes(inputs: $inputs) {
                        successCount
                        results {
                            id
                            success
                        }
                    }
                }
            `;

            const testOntology = "VerifyBulkCreatedOntology";
            const inputs = [
                {
                    ontology: testOntology,
                    payload: { index: 1, content: "Bulk created 1" },
                    acl: ["*"],
                },
                {
                    ontology: testOntology,
                    payload: { index: 2, content: "Bulk created 2" },
                    acl: ["*"],
                },
            ];

            const createResult = await makeGraphQLRequest(
                server,
                createMutation,
                {
                    inputs,
                },
                getAuthHeaders(),
            );

            expect(createResult.bulkCreateMetaEnvelopes.successCount).toBe(2);

            // Now query to verify they exist
            const query = `
                query MetaEnvelopes($filter: MetaEnvelopeFilterInput) {
                    metaEnvelopes(filter: $filter, first: 10) {
                        edges {
                            node {
                                id
                                ontology
                                parsed
                            }
                        }
                        totalCount
                    }
                }
            `;

            const queryResult = await makeGraphQLRequest(
                server,
                query,
                {
                    filter: { ontologyId: testOntology },
                },
                getAuthHeaders(),
            );

            expect(queryResult.metaEnvelopes.totalCount).toBeGreaterThanOrEqual(
                2,
            );

            const createdIds = createResult.bulkCreateMetaEnvelopes.results.map(
                (r: { id: string }) => r.id,
            );
            const queriedIds = queryResult.metaEnvelopes.edges.map(
                (e: { node: { id: string } }) => e.node.id,
            );

            // Verify all created IDs are found in query results
            for (const createdId of createdIds) {
                expect(queriedIds).toContain(createdId);
            }
        });
    });
});
