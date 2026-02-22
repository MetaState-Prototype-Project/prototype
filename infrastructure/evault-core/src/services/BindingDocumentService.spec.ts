import {
    Neo4jContainer,
    type StartedNeo4jContainer,
} from "@testcontainers/neo4j";
import neo4j, { type Driver } from "neo4j-driver";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DbService } from "../core/db/db.service";
import { BindingDocumentService } from "./BindingDocumentService";

describe("BindingDocumentService (integration)", () => {
    let container: StartedNeo4jContainer;
    let dbService: DbService;
    let bindingDocumentService: BindingDocumentService;
    let driver: Driver;
    const TEST_ENAME = "@test-user-123";

    beforeAll(async () => {
        container = await new Neo4jContainer("neo4j:5.15").start();

        const username = container.getUsername();
        const password = container.getPassword();
        const boltPort = container.getMappedPort(7687);
        const uri = `bolt://localhost:${boltPort}`;

        driver = neo4j.driver(uri, neo4j.auth.basic(username, password));
        dbService = new DbService(driver);
        bindingDocumentService = new BindingDocumentService(dbService);
    }, 120000);

    afterAll(async () => {
        await dbService.close();
        await driver.close();
        await container.stop();
    });

    describe("createBindingDocument", () => {
        it("should create a binding document with id_document type", async () => {
            const result = await bindingDocumentService.createBindingDocument(
                {
                    subject: "test-user-123",
                    type: "id_document",
                    data: {
                        vendor: "onfido",
                        reference: "ref-12345",
                        name: "John Doe",
                    },
                    ownerSignature: {
                        signer: TEST_ENAME,
                        signature: "sig-abc123",
                        timestamp: new Date().toISOString(),
                    },
                },
                TEST_ENAME,
            );

            expect(result.id).toBeDefined();
            expect(result.bindingDocument).toBeDefined();
            expect(result.bindingDocument.subject).toBe(TEST_ENAME);
            expect(result.bindingDocument.type).toBe("id_document");
            expect(result.bindingDocument.data).toEqual({
                vendor: "onfido",
                reference: "ref-12345",
                name: "John Doe",
            });
            expect(result.bindingDocument.signatures).toHaveLength(1);
            expect(result.bindingDocument.signatures[0].signer).toBe(
                TEST_ENAME,
            );
        });

        it("should create a binding document with photograph type", async () => {
            const result = await bindingDocumentService.createBindingDocument(
                {
                    subject: "test-user-123",
                    type: "photograph",
                    data: {
                        photoBlob: "base64encodedimage==",
                    },
                    ownerSignature: {
                        signer: TEST_ENAME,
                        signature: "sig-photo-123",
                        timestamp: new Date().toISOString(),
                    },
                },
                TEST_ENAME,
            );

            expect(result.bindingDocument.type).toBe("photograph");
            expect(result.bindingDocument.data).toEqual({
                photoBlob: "base64encodedimage==",
            });
        });

        it("should create a binding document with social_connection type", async () => {
            const result = await bindingDocumentService.createBindingDocument(
                {
                    subject: "test-user-123",
                    type: "social_connection",
                    data: {
                        name: "Alice Smith",
                    },
                    ownerSignature: {
                        signer: TEST_ENAME,
                        signature: "sig-social-123",
                        timestamp: new Date().toISOString(),
                    },
                },
                TEST_ENAME,
            );

            expect(result.bindingDocument.type).toBe("social_connection");
            expect(result.bindingDocument.data).toEqual({
                name: "Alice Smith",
            });
        });

        it("should create a binding document with self type", async () => {
            const result = await bindingDocumentService.createBindingDocument(
                {
                    subject: "test-user-123",
                    type: "self",
                    data: {
                        name: "Bob Jones",
                    },
                    ownerSignature: {
                        signer: TEST_ENAME,
                        signature: "sig-self-123",
                        timestamp: new Date().toISOString(),
                    },
                },
                TEST_ENAME,
            );

            expect(result.bindingDocument.type).toBe("self");
            expect(result.bindingDocument.data).toEqual({
                name: "Bob Jones",
            });
        });

        it("should normalize subject to include @ prefix", async () => {
            const result = await bindingDocumentService.createBindingDocument(
                {
                    subject: "test-user-456",
                    type: "self",
                    data: {
                        name: "Test User",
                    },
                    ownerSignature: {
                        signer: TEST_ENAME,
                        signature: "sig-normalize",
                        timestamp: new Date().toISOString(),
                    },
                },
                TEST_ENAME,
            );

            expect(result.bindingDocument.subject).toBe("@test-user-456");
        });

        it("should keep subject as-is if @ prefix already present", async () => {
            const result = await bindingDocumentService.createBindingDocument(
                {
                    subject: "@already-prefixed",
                    type: "self",
                    data: {
                        name: "Prefixed User",
                    },
                    ownerSignature: {
                        signer: TEST_ENAME,
                        signature: "sig-prefixed",
                        timestamp: new Date().toISOString(),
                    },
                },
                TEST_ENAME,
            );

            expect(result.bindingDocument.subject).toBe("@already-prefixed");
        });
    });

    describe("getBindingDocument", () => {
        it("should retrieve a binding document by ID", async () => {
            const created = await bindingDocumentService.createBindingDocument(
                {
                    subject: "test-user-123",
                    type: "self",
                    data: {
                        name: "Retrieve Test",
                    },
                    ownerSignature: {
                        signer: TEST_ENAME,
                        signature: "sig-retrieve",
                        timestamp: new Date().toISOString(),
                    },
                },
                TEST_ENAME,
            );

            const retrieved = await bindingDocumentService.getBindingDocument(
                created.id,
                TEST_ENAME,
            );

            expect(retrieved).toBeDefined();
            expect(retrieved?.subject).toBe(TEST_ENAME);
            expect(retrieved?.type).toBe("self");
        });

        it("should return null for non-existent binding document", async () => {
            const retrieved = await bindingDocumentService.getBindingDocument(
                "non-existent-id",
                TEST_ENAME,
            );

            expect(retrieved).toBeNull();
        });

        it("should return null when ID is not a binding document", async () => {
            const regularDoc = await dbService.storeMetaEnvelope(
                {
                    ontology: "some-other-ontology",
                    payload: { key: "value" },
                    acl: [TEST_ENAME],
                },
                [TEST_ENAME],
                TEST_ENAME,
            );

            const retrieved = await bindingDocumentService.getBindingDocument(
                regularDoc.metaEnvelope.id,
                TEST_ENAME,
            );

            expect(retrieved).toBeNull();
        });
    });

    describe("addCounterpartySignature", () => {
        it("should add a counterparty signature to existing binding document", async () => {
            const created = await bindingDocumentService.createBindingDocument(
                {
                    subject: "test-user-123",
                    type: "self",
                    data: {
                        name: "Signature Test",
                    },
                    ownerSignature: {
                        signer: TEST_ENAME,
                        signature: "owner-sig",
                        timestamp: new Date().toISOString(),
                    },
                },
                TEST_ENAME,
            );

            const updated =
                await bindingDocumentService.addCounterpartySignature(
                    {
                        metaEnvelopeId: created.id,
                        signature: {
                            signer: "@counterparty-456",
                            signature: "counterparty-sig-xyz",
                            timestamp: new Date().toISOString(),
                        },
                    },
                    TEST_ENAME,
                );

            expect(updated.signatures).toHaveLength(2);
            expect(updated.signatures[0].signer).toBe(TEST_ENAME);
            expect(updated.signatures[1].signer).toBe("@counterparty-456");
            expect(updated.signatures[1].signature).toBe(
                "counterparty-sig-xyz",
            );
        });

        it("should throw error when binding document not found", async () => {
            await expect(
                bindingDocumentService.addCounterpartySignature(
                    {
                        metaEnvelopeId: "non-existent-id",
                        signature: {
                            signer: TEST_ENAME,
                            signature: "sig",
                            timestamp: new Date().toISOString(),
                        },
                    },
                    TEST_ENAME,
                ),
            ).rejects.toThrow("Binding document not found");
        });
    });

    describe("findBindingDocuments", () => {
        it("should find all binding documents for an eName", async () => {
            await bindingDocumentService.createBindingDocument(
                {
                    subject: "test-user-123",
                    type: "self",
                    data: { name: "Find Test 1" },
                    ownerSignature: {
                        signer: TEST_ENAME,
                        signature: "sig1",
                        timestamp: new Date().toISOString(),
                    },
                },
                TEST_ENAME,
            );

            await bindingDocumentService.createBindingDocument(
                {
                    subject: "test-user-123",
                    type: "id_document",
                    data: {
                        vendor: "test",
                        reference: "ref",
                        name: "Find Test 2",
                    },
                    ownerSignature: {
                        signer: TEST_ENAME,
                        signature: "sig2",
                        timestamp: new Date().toISOString(),
                    },
                },
                TEST_ENAME,
            );

            const result = await bindingDocumentService.findBindingDocuments(
                TEST_ENAME,
                {},
            );

            expect(result.edges.length).toBeGreaterThanOrEqual(2);
        });

        it("should filter binding documents by type", async () => {
            await bindingDocumentService.createBindingDocument(
                {
                    subject: "test-user-123",
                    type: "self",
                    data: { name: "Type Filter Test" },
                    ownerSignature: {
                        signer: TEST_ENAME,
                        signature: "sig-type-filter",
                        timestamp: new Date().toISOString(),
                    },
                },
                TEST_ENAME,
            );

            const result = await bindingDocumentService.findBindingDocuments(
                TEST_ENAME,
                { type: "id_document" },
            );

            for (const edge of result.edges) {
                expect(edge.node.parsed?.type).toBe("id_document");
            }
        });
    });
});
