import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createYoga } from "graphql-yoga";
import { createServer } from "http";
import neo4j from "neo4j-driver";
import { DbService } from "../src/db/db.service";
import { GraphQLServer } from "../src/protocol/graphql-server";
import { W3IDBuilder } from "w3id";
import { VaultContext } from "../src/protocol/vault-access-guard";
import { MockStorage } from "./utils/mock-storage";
import { createMockSigner } from "./utils/mock-signer";
import { Neo4jContainer } from "@testcontainers/neo4j";
import { createServer as createNetServer } from "net";

async function getFreePort() {
    return new Promise((resolve, reject) => {
        const server = createNetServer();
        server.listen(0, () => {
            const address = server.address();
            if (address && typeof address === "object") {
                server.close(() => resolve(address.port));
            } else {
                server.close(() => reject(new Error("No port found")));
            }
        });
    });
}

describe("eVault E2E", () => {
    let server;
    let dbService;
    let driver;
    let w3id;
    let testEnvelopeId;
    let port: number;

    const testOntology = "SocialMediaPost";
    const testPayload = {
        text: "gm world",
        dateCreated: new Date().toISOString(),
    };

    beforeAll(async () => {
        const container = await new Neo4jContainer("neo4j:5.15").start();
        const uri = `bolt://localhost:${container.getMappedPort(7687)}`;
        driver = neo4j.driver(
            uri,
            neo4j.auth.basic(container.getUsername(), container.getPassword()),
        );
        dbService = new DbService(driver);

        const signer = createMockSigner();
        const repo = new MockStorage();
        w3id = await new W3IDBuilder()
            .withSigner(signer)
            .withRepository(repo)
            .withNextKeyHash("x")
            .build();

        const yoga = createYoga({
            schema: new GraphQLServer(dbService).getSchema(),
            context: async ({ request }) => {
                const authHeader = request.headers.get("authorization") ?? "";
                const token = authHeader.replace("Bearer ", "");
                return {
                    currentUser: token ? w3id.id : null,
                } satisfies VaultContext;
            },
        });

        const httpServer = createServer(yoga);
        port = await getFreePort();
        await new Promise((resolve) => httpServer.listen(port, resolve));
        server = httpServer;
    });

    afterAll(async () => {
        await server.close();
        await driver.close();
    });

    const executeGraphQL = async (query, variables = {}, token) => {
        const res = await fetch(`http://localhost:${port}/graphql`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify({ query, variables }),
        });
        return res.json();
    };

    it("should store and retrieve a meta envelope", async () => {
        const token = await w3id.signJWT({ sub: w3id.id });

        const store = await executeGraphQL(
            `mutation Store($input: MetaEnvelopeInput!) {
        storeMetaEnvelope(input: $input) {
          metaEnvelope { id ontology parsed }
          envelopes { id ontology value valueType }
        }
      }`,
            {
                input: {
                    ontology: testOntology,
                    payload: testPayload,
                    acl: ["*"],
                },
            },
            token,
        );

        expect(store.errors).toBeUndefined();
        testEnvelopeId = store.data.storeMetaEnvelope.metaEnvelope.id;

        const read = await executeGraphQL(
            `query Read($id: String!) {
        getMetaEnvelopeById(id: $id) {
          id ontology parsed envelopes { id ontology value }
        }
      }`,
            { id: testEnvelopeId },
            token,
        );

        expect(read.errors).toBeUndefined();
        expect(read.data.getMetaEnvelopeById.ontology).toBe(testOntology);
        expect(read.data.getMetaEnvelopeById.parsed.text).toBe("gm world");
    });

    it("should reject unauthorized access", async () => {
        const token = await w3id.signJWT({ sub: w3id.id });
        const store = await executeGraphQL(
            `mutation Store($input: MetaEnvelopeInput!) {
        storeMetaEnvelope(input: $input) {
          metaEnvelope { id ontology parsed }
          envelopes { id ontology value valueType }
        }
      }`,
            {
                input: {
                    ontology: testOntology,
                    payload: testPayload,
                    acl: ["@001231232"],
                },
            },
            token,
        );

        expect(store.errors).toBeUndefined();
        const unauthEnvId = store.data.storeMetaEnvelope.metaEnvelope.id;

        const otherSigner = createMockSigner();
        const otherRepo = new MockStorage();
        const other = await new W3IDBuilder()
            .withSigner(otherSigner)
            .withRepository(otherRepo)
            .withNextKeyHash("z")
            .build();
        const otherToken = await other.signJWT({ sub: other.id });

        const result = await executeGraphQL(
            `query Read($id: String!) {
        getMetaEnvelopeById(id: $id) { id }
      }`,
            { id: unauthEnvId },
            otherToken,
        );

        expect(result.data.getMetaEnvelopeById).toBeNull();
    });

    it("should allow wildcard ACL read", async () => {
        const token = await w3id.signJWT({ sub: w3id.id });

        const store = await executeGraphQL(
            `mutation Store($input: MetaEnvelopeInput!) {
        storeMetaEnvelope(input: $input) {
          metaEnvelope { id }
        }
      }`,
            {
                input: {
                    ontology: testOntology,
                    payload: testPayload,
                    acl: ["*"],
                },
            },
            token,
        );

        const id = store.data.storeMetaEnvelope.metaEnvelope.id;

        const readerSigner = createMockSigner();
        const reader = await new W3IDBuilder()
            .withSigner(readerSigner)
            .withRepository(new MockStorage())
            .withNextKeyHash("r")
            .build();
        const readerToken = await reader.signJWT({ sub: reader.id });

        const result = await executeGraphQL(
            `query Read($id: String!) {
        getMetaEnvelopeById(id: $id) { id ontology parsed }
      }`,
            { id },
            readerToken,
        );

        expect(result.errors).toBeUndefined();
        expect(result.data.getMetaEnvelopeById.id).toBe(id);
    });

    it("should search meta envelopes by term", async () => {
        const token = await w3id.signJWT({ sub: w3id.id });
        const term = "searchable";
        await executeGraphQL(
            `mutation Store($input: MetaEnvelopeInput!) {
        storeMetaEnvelope(input: $input) { metaEnvelope { id } }
      }`,
            {
                input: {
                    ontology: "search-test",
                    payload: { note: term },
                    acl: ["*"],
                },
            },
            token,
        );

        const result = await executeGraphQL(
            `query Search($ontology: String!, $term: String!) {
        searchMetaEnvelopes(ontology: $ontology, term: $term) { id parsed }
      }`,
            { ontology: "search-test", term },
            token,
        );

        expect(result.errors).toBeUndefined();
        expect(result.data.searchMetaEnvelopes[0].parsed.note).toBe(term);
    });
});
