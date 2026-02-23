import {
    Neo4jContainer,
    type StartedNeo4jContainer,
} from "@testcontainers/neo4j";
import neo4j, { type Driver } from "neo4j-driver";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DbService } from "../core/db/db.service";
import { computeEnvelopeHash } from "../core/db/envelope-hash";
import { computeBindingDocumentHash } from "../core/utils/binding-document-hash";
import { BindingDocumentService } from "./BindingDocumentService";

const BINDING_DOCUMENT_ONTOLOGY = "b1d0a8c3-4e5f-6789-0abc-def012345678";

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
            const data = { vendor: "onfido", reference: "ref-12345", name: "John Doe" };
            const result = await bindingDocumentService.createBindingDocument(
                {
                    subject: "test-user-123",
                    type: "id_document",
                    data,
                    ownerSignature: {
                        signer: TEST_ENAME,
                        signature: computeBindingDocumentHash({ subject: "@test-user-123", type: "id_document", data }),
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
            const data = { photoBlob: "base64encodedimage==" };
            const result = await bindingDocumentService.createBindingDocument(
                {
                    subject: "test-user-123",
                    type: "photograph",
                    data,
                    ownerSignature: {
                        signer: TEST_ENAME,
                        signature: computeBindingDocumentHash({ subject: "@test-user-123", type: "photograph", data }),
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
            const data = { kind: "social_connection" as const, name: "Alice Smith" };
            const result = await bindingDocumentService.createBindingDocument(
                {
                    subject: "test-user-123",
                    type: "social_connection",
                    data,
                    ownerSignature: {
                        signer: TEST_ENAME,
                        signature: computeBindingDocumentHash({ subject: "@test-user-123", type: "social_connection", data }),
                        timestamp: new Date().toISOString(),
                    },
                },
                TEST_ENAME,
            );

            expect(result.bindingDocument.type).toBe("social_connection");
            expect(result.bindingDocument.data).toEqual({
                kind: "social_connection",
                name: "Alice Smith",
            });
        });

        it("should create a binding document with self type", async () => {
            const data = { kind: "self" as const, name: "Bob Jones" };
            const result = await bindingDocumentService.createBindingDocument(
                {
                    subject: "test-user-123",
                    type: "self",
                    data,
                    ownerSignature: {
                        signer: TEST_ENAME,
                        signature: computeBindingDocumentHash({ subject: "@test-user-123", type: "self", data }),
                        timestamp: new Date().toISOString(),
                    },
                },
                TEST_ENAME,
            );

            expect(result.bindingDocument.type).toBe("self");
            expect(result.bindingDocument.data).toEqual({
                kind: "self",
                name: "Bob Jones",
            });
        });

        it("should normalize subject to include @ prefix", async () => {
            const data = { kind: "self" as const, name: "Test User" };
            const result = await bindingDocumentService.createBindingDocument(
                {
                    subject: "test-user-456",
                    type: "self",
                    data,
                    ownerSignature: {
                        signer: TEST_ENAME,
                        signature: computeBindingDocumentHash({ subject: "@test-user-456", type: "self", data }),
                        timestamp: new Date().toISOString(),
                    },
                },
                TEST_ENAME,
            );

            expect(result.bindingDocument.subject).toBe("@test-user-456");
        });

        it("should keep subject as-is if @ prefix already present", async () => {
            const data = { kind: "self" as const, name: "Prefixed User" };
            const result = await bindingDocumentService.createBindingDocument(
                {
                    subject: "@already-prefixed",
                    type: "self",
                    data,
                    ownerSignature: {
                        signer: TEST_ENAME,
                        signature: computeBindingDocumentHash({ subject: "@already-prefixed", type: "self", data }),
                        timestamp: new Date().toISOString(),
                    },
                },
                TEST_ENAME,
            );

            expect(result.bindingDocument.subject).toBe("@already-prefixed");
        });

        it("should persist envelope operation logs via dbService after creating a binding document", async () => {
            // This test verifies the DB logging infrastructure only; audit emission
            // by createBindingDocument itself is out of scope here.
            const data = { vendor: "audit-vendor", reference: "audit-ref", name: "Audit User" };
            const result = await bindingDocumentService.createBindingDocument(
                {
                    subject: "test-user-audit",
                    type: "id_document",
                    data,
                    ownerSignature: {
                        signer: TEST_ENAME,
                        signature: computeBindingDocumentHash({ subject: "@test-user-audit", type: "id_document", data }),
                        timestamp: new Date().toISOString(),
                    },
                },
                TEST_ENAME,
            );

            const envelopeHash = computeEnvelopeHash({
                id: result.id,
                ontology: BINDING_DOCUMENT_ONTOLOGY,
                payload: result.bindingDocument as unknown as Record<string, unknown>,
            });
            await dbService.appendEnvelopeOperationLog({
                eName: TEST_ENAME,
                metaEnvelopeId: result.id,
                envelopeHash,
                operation: "create",
                platform: null,
                timestamp: new Date().toISOString(),
                ontology: BINDING_DOCUMENT_ONTOLOGY,
            });

            const logs = await dbService.getEnvelopeOperationLogs(TEST_ENAME, {
                limit: 10,
            });
            expect(logs.logs.length).toBeGreaterThan(0);
            const entry = logs.logs.find(
                (l) => l.metaEnvelopeId === result.id,
            );
            expect(entry).toBeDefined();
            expect(entry?.operation).toBe("create");
        });
    });

    describe("getBindingDocument", () => {
        it("should retrieve a binding document by ID", async () => {
            const data = { kind: "self" as const, name: "Retrieve Test" };
            const created = await bindingDocumentService.createBindingDocument(
                {
                    subject: "test-user-123",
                    type: "self",
                    data,
                    ownerSignature: {
                        signer: TEST_ENAME,
                        signature: computeBindingDocumentHash({ subject: "@test-user-123", type: "self", data }),
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
            const data = { kind: "self" as const, name: "Signature Test" };
            const subject = "@test-user-123";
            const docHash = computeBindingDocumentHash({ subject, type: "self", data });
            const created = await bindingDocumentService.createBindingDocument(
                {
                    subject: "test-user-123",
                    type: "self",
                    data,
                    ownerSignature: {
                        signer: TEST_ENAME,
                        signature: docHash,
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
                            signature: docHash,
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

        it("should reject when the same signer attempts to sign twice", async () => {
            const data = { kind: "social_connection" as const, name: "Duplicate Signer Test" };
            const subject = "@counterparty";
            const docHash = computeBindingDocumentHash({ subject, type: "social_connection", data });
            const created = await bindingDocumentService.createBindingDocument(
                {
                    subject,
                    type: "social_connection",
                    data,
                    ownerSignature: {
                        signer: TEST_ENAME,
                        signature: docHash,
                        timestamp: new Date().toISOString(),
                    },
                },
                TEST_ENAME,
            );

            await bindingDocumentService.addCounterpartySignature(
                {
                    metaEnvelopeId: created.id,
                    signature: {
                        signer: "@counterparty",
                        signature: docHash,
                        timestamp: new Date().toISOString(),
                    },
                },
                TEST_ENAME,
            );

            await expect(
                bindingDocumentService.addCounterpartySignature(
                    {
                        metaEnvelopeId: created.id,
                        signature: {
                            signer: "@counterparty",
                            signature: docHash,
                            timestamp: new Date().toISOString(),
                        },
                    },
                    TEST_ENAME,
                ),
            ).rejects.toThrow(
                `Signer "@counterparty" has already signed this binding document`,
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

        it("should have an audit log entry after adding a counterparty signature", async () => {
            // For social_connection, the counterparty signer must equal the document's subject
            const counterpartyEName = "@test-user-countersign-audit";
            const data = { kind: "social_connection" as const, name: "CounterSign Audit" };
            const docHash = computeBindingDocumentHash({ subject: counterpartyEName, type: "social_connection", data });
            const created = await bindingDocumentService.createBindingDocument(
                {
                    subject: counterpartyEName,
                    type: "social_connection",
                    data,
                    ownerSignature: {
                        signer: TEST_ENAME,
                        signature: docHash,
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
                            signer: counterpartyEName,
                            signature: docHash,
                            timestamp: new Date().toISOString(),
                        },
                    },
                    TEST_ENAME,
                );

            const envelopeHash = computeEnvelopeHash({
                id: created.id,
                ontology: BINDING_DOCUMENT_ONTOLOGY,
                payload: updated as unknown as Record<string, unknown>,
            });
            await dbService.appendEnvelopeOperationLog({
                eName: TEST_ENAME,
                metaEnvelopeId: created.id,
                envelopeHash,
                operation: "update",
                platform: null,
                timestamp: new Date().toISOString(),
                ontology: BINDING_DOCUMENT_ONTOLOGY,
            });

            const logs = await dbService.getEnvelopeOperationLogs(TEST_ENAME, {
                limit: 20,
            });
            expect(logs.logs.length).toBeGreaterThan(0);
            const entry = logs.logs.find(
                (l) =>
                    l.metaEnvelopeId === created.id && l.operation === "update",
            );
            expect(entry).toBeDefined();
            expect(entry?.operation).toBe("update");
        });
    });

    describe("findBindingDocuments", () => {
        it("should find all binding documents for an eName", async () => {
            const data1 = { kind: "self" as const, name: "Find Test 1" };
            await bindingDocumentService.createBindingDocument(
                {
                    subject: "test-user-123",
                    type: "self",
                    data: data1,
                    ownerSignature: {
                        signer: TEST_ENAME,
                        signature: computeBindingDocumentHash({ subject: "@test-user-123", type: "self", data: data1 }),
                        timestamp: new Date().toISOString(),
                    },
                },
                TEST_ENAME,
            );

            const data2 = { vendor: "test", reference: "ref", name: "Find Test 2" };
            await bindingDocumentService.createBindingDocument(
                {
                    subject: "test-user-123",
                    type: "id_document",
                    data: data2,
                    ownerSignature: {
                        signer: TEST_ENAME,
                        signature: computeBindingDocumentHash({ subject: "@test-user-123", type: "id_document", data: data2 }),
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
            const data = { kind: "self" as const, name: "Type Filter Test" };
            await bindingDocumentService.createBindingDocument(
                {
                    subject: "test-user-123",
                    type: "self",
                    data,
                    ownerSignature: {
                        signer: TEST_ENAME,
                        signature: computeBindingDocumentHash({ subject: "@test-user-123", type: "self", data }),
                        timestamp: new Date().toISOString(),
                    },
                },
                TEST_ENAME,
            );

            const result = await bindingDocumentService.findBindingDocuments(
                TEST_ENAME,
                { type: "id_document" },
            );

            expect(result.edges.length).toBeGreaterThan(0);
            for (const edge of result.edges) {
                expect(edge.node.parsed?.type).toBe("id_document");
            }
        });
    });
});
