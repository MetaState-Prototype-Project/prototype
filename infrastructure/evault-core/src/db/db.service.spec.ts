import neo4j, { Driver } from "neo4j-driver";
import { DbService } from "./db.service"; // adjust if needed
import { it, describe, beforeAll, afterAll, expect } from "vitest";
import { v4 as uuidv4 } from "uuid";
import { Neo4jContainer, StartedNeo4jContainer } from "@testcontainers/neo4j";

type Envelope = {
    id: string;
    ontology: string;
    value: any;
};

describe("DbService (integration)", () => {
    let container: StartedNeo4jContainer;
    let service: DbService;
    let driver: Driver;

    beforeAll(async () => {
        container = await new Neo4jContainer("neo4j:4.4.12").start();

        const username = container.getUsername();
        const password = container.getPassword();
        const boltPort = container.getMappedPort(7687);
        const uri = `bolt://localhost:${boltPort}`;

        driver = neo4j.driver(uri, neo4j.auth.basic(username, password));
        service = new DbService(uri, username, password);
    });

    afterAll(async () => {
        await service.close();
        await driver.close();
        await container.stop();
    });

    it("should store and retrieve a meta-envelope", async () => {
        const input = {
            ontology: "SocialMediaPost",
            payload: {
                text: "hello world",
                dateCreated: "2025-04-10",
                likes: ["user1", "user2"],
            },
            acl: ["@test-user"],
        };

        const result = await service.storeMetaEnvelope(input, input.acl);
        const id = result.metaEnvelope.id;

        const fetched = await service.findMetaEnvelopeById(id);
        expect(fetched).toBeDefined();
        expect(fetched.id).toBeDefined();
        expect(fetched.ontology).toBe("SocialMediaPost");
        expect(fetched.acl).toEqual(["@test-user"]);
        expect(fetched.envelopes).toHaveLength(3);
        expect(fetched.envelopes[0]).toEqual(
            expect.objectContaining({
                id: expect.any(String),
                ontology: expect.any(String),
                value: expect.any(String),
            }),
        );

        console.log(fetched);
    });

    it("should find meta-envelopes containing the search term in any envelope value", async () => {
        const input = {
            ontology: "SocialMediaPost",
            payload: {
                text: "This is a searchable tweet",
                image: "https://example.com/image.jpg",
                likes: ["user1", "user2"],
            },
            acl: ["@search-test-user"],
        };

        const metaEnv = await service.storeMetaEnvelope(input, input.acl);

        const found = await service.findMetaEnvelopesBySearchTerm(
            "SocialMediaPost",
            "searchable",
        );

        expect(Array.isArray(found)).toBe(true);
        const match = found.find((m) => m.id === metaEnv.metaEnvelope.id);
        expect(match).toBeDefined();
        if (!match) throw new Error();
        expect(match.envelopes.length).toBeGreaterThan(0);
        expect(
            match.envelopes.some((e) => e.value.includes("searchable")),
        ).toBe(true);
    });

    it("should return empty array if no values contain the search term", async () => {
        const found = await service.findMetaEnvelopesBySearchTerm(
            "SocialMediaPost",
            "notfoundterm",
        );
        expect(Array.isArray(found)).toBe(true);
        expect(found.length).toBe(0);
    });

    it("should find meta-envelopes by ontology", async () => {
        const results =
            await service.findMetaEnvelopesByOntology("SocialMediaPost");
        expect(Array.isArray(results)).toBe(true);
        expect(results.length).toBeGreaterThan(0);
    });

    it("should delete a meta-envelope and its envelopes", async () => {
        const meta = {
            ontology: "TempPost",
            payload: {
                value: "to be deleted",
            },
            acl: ["@delete-user"],
        };

        const stored = await service.storeMetaEnvelope(meta, meta.acl);
        await service.deleteMetaEnvelope(stored.metaEnvelope.id);

        const deleted = await service.findMetaEnvelopeById(
            stored.metaEnvelope.id,
        );
        expect(deleted).toBeNull();
    });

    it("should update envelope value", async () => {
        const meta = {
            ontology: "UpdateTest",
            payload: {
                value: "original",
            },
            acl: ["@updater"],
        };

        const stored = await service.storeMetaEnvelope(meta, meta.acl);

        const result = await service.findMetaEnvelopeById(
            stored.metaEnvelope.id,
        );
        const targetEnvelope = result.envelopes.find(
            (e: Envelope) => e.ontology === "value",
        );

        await service.updateEnvelopeValue(targetEnvelope.id, "updated");

        const updated = await service.findMetaEnvelopeById(
            stored.metaEnvelope.id,
        );
        const updatedValue = updated.envelopes.find(
            (e: Envelope) => e.id === targetEnvelope.id,
        );
        expect(updatedValue.value).toBe("updated");
    });
});
