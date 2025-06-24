import neo4j, { Driver } from "neo4j-driver";
import { DbService } from "./db.service"; // adjust if needed
import { it, describe, beforeAll, afterAll, expect } from "vitest";
import { Neo4jContainer, StartedNeo4jContainer } from "@testcontainers/neo4j";

type Envelope = {
    id: string;
    ontology: string;
    value: any;
    valueType: string;
};

describe("DbService (integration)", () => {
    let container: StartedNeo4jContainer;
    let service: DbService;
    let driver: Driver;

    beforeAll(async () => {
        container = await new Neo4jContainer("neo4j:5.15").start();

        const username = container.getUsername();
        const password = container.getPassword();
        const boltPort = container.getMappedPort(7687);
        const uri = `bolt://localhost:${boltPort}`;

        driver = neo4j.driver(uri, neo4j.auth.basic(username, password));
        service = new DbService(driver);
    });

    afterAll(async () => {
        await service.close();
        await driver.close();
        await container.stop();
    });

    it("should store and retrieve a meta-envelope with various data types", async () => {
        const input = {
            ontology: "TestTypes",
            payload: {
                string: "hello world",
                number: 42,
                boolean: true,
                date: new Date("2025-04-10T00:00:00Z"),
                array: [1, 2, 3],
                object: { nested: { value: "deep" } },
            },
            acl: ["@test-user"],
        };

        const result = await service.storeMetaEnvelope(input, input.acl);
        const id = result.metaEnvelope.id;

        const fetched = await service.findMetaEnvelopeById(id);
        expect(fetched).toBeDefined();
        if (!fetched) return;
        expect(fetched.id).toBeDefined();
        expect(fetched.ontology).toBe("TestTypes");
        expect(fetched.acl).toEqual(["@test-user"]);
        expect(fetched.envelopes).toHaveLength(6);

        // Verify parsed field matches original payload
        expect(fetched.parsed).toEqual(input.payload);

        // Verify each data type is properly stored and retrieved
        const envelopes = fetched.envelopes.reduce(
            (acc: Record<string, Envelope>, e: Envelope) => {
                acc[e.ontology] = e;
                return acc;
            },
            {},
        );

        expect(envelopes.string.value).toBe("hello world");
        expect(envelopes.string.valueType).toBe("string");

        expect(envelopes.number.value).toBe(42);
        expect(envelopes.number.valueType).toBe("number");

        expect(envelopes.boolean.value).toBe(true);
        expect(envelopes.boolean.valueType).toBe("boolean");

        expect(envelopes.date.value).toBeInstanceOf(Date);
        expect(envelopes.date.value.toISOString()).toBe(
            "2025-04-10T00:00:00.000Z",
        );
        expect(envelopes.date.valueType).toBe("date");

        expect(envelopes.array.value).toEqual([1, 2, 3]);
        expect(envelopes.array.valueType).toBe("array");

        expect(envelopes.object.value).toEqual({ nested: { value: "deep" } });
        expect(envelopes.object.valueType).toBe("object");
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

    it("should update envelope value with proper type handling", async () => {
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
        if (!result) return;
        const targetEnvelope = result.envelopes.find(
            (e: Envelope) => e.ontology === "value",
        );

        // Update with a different type
        const newValue = new Date("2025-04-10T00:00:00Z");
        if (!targetEnvelope) return;
        await service.updateEnvelopeValue(targetEnvelope.id, newValue);

        const updated = await service.findMetaEnvelopeById(
            stored.metaEnvelope.id,
        );
        if (!updated) return;
        const updatedValue = updated.envelopes.find(
            (e: Envelope) => e.id === targetEnvelope.id,
        );

        if (!updatedValue) return;
        expect(updatedValue.value).toBeInstanceOf(Date);
        expect(updatedValue.value.toISOString()).toBe(
            "2025-04-10T00:00:00.000Z",
        );
        expect(updatedValue.valueType).toBe("date");
    });

    it("should find meta-envelopes containing the search term in any value type", async () => {
        const input = {
            ontology: "SearchTest",
            payload: {
                string: "This is a searchable string",
                array: ["searchable", "array", "element"],
                object: { text: "searchable object" },
                number: 42,
                date: new Date("2025-04-10T00:00:00Z"),
            },
            acl: ["@search-test-user"],
        };

        const metaEnv = await service.storeMetaEnvelope(input, input.acl);

        // Test search in string
        const foundInString = await service.findMetaEnvelopesBySearchTerm(
            "SearchTest",
            "searchable string",
        );
        expect(foundInString.length).toBeGreaterThan(0);
        expect(foundInString[0].id).toBe(metaEnv.metaEnvelope.id);

        // Test search in array
        const foundInArray = await service.findMetaEnvelopesBySearchTerm(
            "SearchTest",
            "searchable",
        );
        expect(foundInArray.length).toBeGreaterThan(0);
        expect(foundInArray[0].id).toBe(metaEnv.metaEnvelope.id);

        // Test search in object
        const foundInObject = await service.findMetaEnvelopesBySearchTerm(
            "SearchTest",
            "searchable object",
        );
        expect(foundInObject.length).toBeGreaterThan(0);
        expect(foundInObject[0].id).toBe(metaEnv.metaEnvelope.id);
    });

    it("should find meta-envelopes containing the search term with parsed payload", async () => {
        const input = {
            ontology: "SearchTestHeyyy",
            payload: {
                string: "This is a searchable string",
                array: ["searchable", "array", "element"],
                object: { text: "searchable object" },
                number: 42,
                date: new Date("2025-04-10T00:00:00Z"),
            },
            acl: ["@search-test-user"],
        };

        const metaEnv = await service.storeMetaEnvelope(input, input.acl);

        // Test search in string
        const foundInString = await service.findMetaEnvelopesBySearchTerm(
            "SearchTestHeyyy",
            "searchable string",
        );
        expect(foundInString.length).toBeGreaterThan(0);
        expect(foundInString[0].id).toBe(metaEnv.metaEnvelope.id);

        // Test search in array
        const foundInArray = await service.findMetaEnvelopesBySearchTerm(
            "SearchTestHeyyy",
            "searchable",
        );
        expect(foundInArray.length).toBeGreaterThan(0);
        expect(foundInArray[0].id).toBe(metaEnv.metaEnvelope.id);

        // Test search in object
        const foundInObject = await service.findMetaEnvelopesBySearchTerm(
            "SearchTestHeyyy",
            "searchable object",
        );
        expect(foundInObject.length).toBeGreaterThan(0);
        expect(foundInObject[0].id).toBe(metaEnv.metaEnvelope.id);
    });
});
