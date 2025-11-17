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
    const TEST_ENAME = "test@example.com";

    beforeAll(async () => {
        container = await new Neo4jContainer("neo4j:5.15").start();

        const username = container.getUsername();
        const password = container.getPassword();
        const boltPort = container.getMappedPort(7687);
        const uri = `bolt://localhost:${boltPort}`;

        driver = neo4j.driver(uri, neo4j.auth.basic(username, password));
        service = new DbService(driver);
    }, 120000);

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

        const result = await service.storeMetaEnvelope(input, input.acl, TEST_ENAME);
        const id = result.metaEnvelope.id;

        const fetched = await service.findMetaEnvelopeById(id, TEST_ENAME);
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

        const metaEnv = await service.storeMetaEnvelope(input, input.acl, TEST_ENAME);

        const found = await service.findMetaEnvelopesBySearchTerm(
            "SocialMediaPost",
            "searchable",
            TEST_ENAME,
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
            TEST_ENAME,
        );
        expect(Array.isArray(found)).toBe(true);
        expect(found.length).toBe(0);
    });

    it("should find meta-envelopes by ontology", async () => {
        const results =
            await service.findMetaEnvelopesByOntology("SocialMediaPost", TEST_ENAME);
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

        const stored = await service.storeMetaEnvelope(meta, meta.acl, TEST_ENAME);
        await service.deleteMetaEnvelope(stored.metaEnvelope.id, TEST_ENAME);

        const deleted = await service.findMetaEnvelopeById(
            stored.metaEnvelope.id,
            TEST_ENAME,
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

        const stored = await service.storeMetaEnvelope(meta, meta.acl, TEST_ENAME);

        const result = await service.findMetaEnvelopeById(
            stored.metaEnvelope.id,
            TEST_ENAME,
        );
        if (!result) return;
        const targetEnvelope = result.envelopes.find(
            (e: Envelope) => e.ontology === "value",
        );

        // Update with a different type
        const newValue = new Date("2025-04-10T00:00:00Z");
        if (!targetEnvelope) return;
        await service.updateEnvelopeValue(targetEnvelope.id, newValue, TEST_ENAME);

        const updated = await service.findMetaEnvelopeById(
            stored.metaEnvelope.id,
            TEST_ENAME,
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

        const metaEnv = await service.storeMetaEnvelope(input, input.acl, TEST_ENAME);

        // Test search in string
        const foundInString = await service.findMetaEnvelopesBySearchTerm(
            "SearchTest",
            "searchable string",
            TEST_ENAME,
        );
        expect(foundInString.length).toBeGreaterThan(0);
        expect(foundInString[0].id).toBe(metaEnv.metaEnvelope.id);

        // Test search in array
        const foundInArray = await service.findMetaEnvelopesBySearchTerm(
            "SearchTest",
            "searchable",
            TEST_ENAME,
        );
        expect(foundInArray.length).toBeGreaterThan(0);
        expect(foundInArray[0].id).toBe(metaEnv.metaEnvelope.id);

        // Test search in object
        const foundInObject = await service.findMetaEnvelopesBySearchTerm(
            "SearchTest",
            "searchable object",
            TEST_ENAME,
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

        const metaEnv = await service.storeMetaEnvelope(input, input.acl, TEST_ENAME);

        // Test search in string
        const foundInString = await service.findMetaEnvelopesBySearchTerm(
            "SearchTestHeyyy",
            "searchable string",
            TEST_ENAME,
        );
        expect(foundInString.length).toBeGreaterThan(0);
        expect(foundInString[0].id).toBe(metaEnv.metaEnvelope.id);

        // Test search in array
        const foundInArray = await service.findMetaEnvelopesBySearchTerm(
            "SearchTestHeyyy",
            "searchable",
            TEST_ENAME,
        );
        expect(foundInArray.length).toBeGreaterThan(0);
        expect(foundInArray[0].id).toBe(metaEnv.metaEnvelope.id);

        // Test search in object
        const foundInObject = await service.findMetaEnvelopesBySearchTerm(
            "SearchTestHeyyy",
            "searchable object",
            TEST_ENAME,
        );
        expect(foundInObject.length).toBeGreaterThan(0);
        expect(foundInObject[0].id).toBe(metaEnv.metaEnvelope.id);
    });

    describe("eName isolation and data leak prevention", () => {
        const TENANT1_ENAME = "tenant1@example.com";
        const TENANT2_ENAME = "tenant2@example.com";

        it("should not return data from other tenants when querying by ID", async () => {
            // Create meta-envelope for tenant1
            const tenant1Meta = await service.storeMetaEnvelope(
                {
                    ontology: "Tenant1Secret",
                    payload: { secret: "tenant1-data" },
                    acl: ["*"],
                },
                ["*"],
                TENANT1_ENAME
            );

            // Try to query tenant1's data with tenant2's eName
            const result = await service.findMetaEnvelopeById(
                tenant1Meta.metaEnvelope.id,
                TENANT2_ENAME
            );

            // Should return null - data leak prevented!
            expect(result).toBeNull();
        });

        it("should not return data from other tenants when querying by ontology", async () => {
            // Create meta-envelopes for both tenants with same ontology
            await service.storeMetaEnvelope(
                {
                    ontology: "SharedOntology",
                    payload: { data: "tenant1-data" },
                    acl: ["*"],
                },
                ["*"],
                TENANT1_ENAME
            );

            await service.storeMetaEnvelope(
                {
                    ontology: "SharedOntology",
                    payload: { data: "tenant2-data" },
                    acl: ["*"],
                },
                ["*"],
                TENANT2_ENAME
            );

            // Query tenant1's data
            const tenant1Results = await service.findMetaEnvelopesByOntology(
                "SharedOntology",
                TENANT1_ENAME
            );

            // Query tenant2's data
            const tenant2Results = await service.findMetaEnvelopesByOntology(
                "SharedOntology",
                TENANT2_ENAME
            );

            // Each tenant should only see their own data
            expect(tenant1Results.length).toBe(1);
            expect(tenant1Results[0].parsed.data).toBe("tenant1-data");

            expect(tenant2Results.length).toBe(1);
            expect(tenant2Results[0].parsed.data).toBe("tenant2-data");

            // Verify no cross-contamination
            const tenant1HasTenant2Data = tenant1Results.some(
                (r) => r.parsed.data === "tenant2-data"
            );
            const tenant2HasTenant1Data = tenant2Results.some(
                (r) => r.parsed.data === "tenant1-data"
            );

            expect(tenant1HasTenant2Data).toBe(false);
            expect(tenant2HasTenant1Data).toBe(false);
        });

        it("should not return data from other tenants when searching", async () => {
            // Create meta-envelopes for both tenants with searchable content
            await service.storeMetaEnvelope(
                {
                    ontology: "Searchable",
                    payload: { text: "tenant1-searchable-text" },
                    acl: ["*"],
                },
                ["*"],
                TENANT1_ENAME
            );

            await service.storeMetaEnvelope(
                {
                    ontology: "Searchable",
                    payload: { text: "tenant2-searchable-text" },
                    acl: ["*"],
                },
                ["*"],
                TENANT2_ENAME
            );

            // Search tenant1's data
            const tenant1Results = await service.findMetaEnvelopesBySearchTerm(
                "Searchable",
                "searchable",
                TENANT1_ENAME
            );

            // Search tenant2's data
            const tenant2Results = await service.findMetaEnvelopesBySearchTerm(
                "Searchable",
                "searchable",
                TENANT2_ENAME
            );

            // Each tenant should only see their own results
            expect(tenant1Results.length).toBe(1);
            expect(tenant1Results[0].parsed.text).toBe("tenant1-searchable-text");

            expect(tenant2Results.length).toBe(1);
            expect(tenant2Results[0].parsed.text).toBe("tenant2-searchable-text");

            // Verify no cross-contamination
            const tenant1HasTenant2Data = tenant1Results.some(
                (r) => r.parsed.text === "tenant2-searchable-text"
            );
            const tenant2HasTenant1Data = tenant2Results.some(
                (r) => r.parsed.text === "tenant1-searchable-text"
            );

            expect(tenant1HasTenant2Data).toBe(false);
            expect(tenant2HasTenant1Data).toBe(false);
        });

        it("should not allow deletion of other tenants' data", async () => {
            // Create meta-envelope for tenant1
            const tenant1Meta = await service.storeMetaEnvelope(
                {
                    ontology: "Tenant1Data",
                    payload: { data: "tenant1-data" },
                    acl: ["*"],
                },
                ["*"],
                TENANT1_ENAME
            );

            // Try to delete tenant1's data using tenant2's eName
            await service.deleteMetaEnvelope(
                tenant1Meta.metaEnvelope.id,
                TENANT2_ENAME
            );

            // Data should still exist (deletion with wrong eName should be a no-op)
            const stillExists = await service.findMetaEnvelopeById(
                tenant1Meta.metaEnvelope.id,
                TENANT1_ENAME
            );

            expect(stillExists).not.toBeNull();
            expect(stillExists?.parsed.data).toBe("tenant1-data");
        });

        it("should not allow updating other tenants' envelope values", async () => {
            // Create meta-envelope for tenant1
            const tenant1Meta = await service.storeMetaEnvelope(
                {
                    ontology: "Tenant1Data",
                    payload: { value: "original-value" },
                    acl: ["*"],
                },
                ["*"],
                TENANT1_ENAME
            );

            const envelopeId = tenant1Meta.envelopes[0].id;

            // Try to update tenant1's envelope using tenant2's eName
            await service.updateEnvelopeValue(
                envelopeId,
                "hacked-value",
                TENANT2_ENAME
            );

            // Value should remain unchanged (update with wrong eName should be a no-op)
            const stillOriginal = await service.findMetaEnvelopeById(
                tenant1Meta.metaEnvelope.id,
                TENANT1_ENAME
            );

            expect(stillOriginal).not.toBeNull();
            expect(stillOriginal?.parsed.value).toBe("original-value");
        });

        it("should not return data from other tenants when querying by multiple IDs", async () => {
            // Create meta-envelopes for both tenants
            const tenant1Meta1 = await service.storeMetaEnvelope(
                {
                    ontology: "Tenant1Data",
                    payload: { data: "tenant1-data-1" },
                    acl: ["*"],
                },
                ["*"],
                TENANT1_ENAME
            );

            const tenant1Meta2 = await service.storeMetaEnvelope(
                {
                    ontology: "Tenant1Data",
                    payload: { data: "tenant1-data-2" },
                    acl: ["*"],
                },
                ["*"],
                TENANT1_ENAME
            );

            const tenant2Meta = await service.storeMetaEnvelope(
                {
                    ontology: "Tenant2Data",
                    payload: { data: "tenant2-data" },
                    acl: ["*"],
                },
                ["*"],
                TENANT2_ENAME
            );

            // Try to query tenant1's IDs with tenant2's eName
            const results = await service.findMetaEnvelopesByIds(
                [tenant1Meta1.metaEnvelope.id, tenant1Meta2.metaEnvelope.id],
                TENANT2_ENAME
            );

            // Should return empty array - data leak prevented!
            expect(results.length).toBe(0);

            // Verify tenant1 can still access their own data
            const tenant1Results = await service.findMetaEnvelopesByIds(
                [tenant1Meta1.metaEnvelope.id, tenant1Meta2.metaEnvelope.id],
                TENANT1_ENAME
            );

            expect(tenant1Results.length).toBe(2);
        });

        it("should throw error when eName is missing", async () => {
            const metaEnvelope = await service.storeMetaEnvelope(
                {
                    ontology: "Test",
                    payload: { data: "test" },
                    acl: ["*"],
                },
                ["*"],
                TENANT1_ENAME
            );

            // All methods should throw when eName is missing
            await expect(
                service.findMetaEnvelopeById(metaEnvelope.metaEnvelope.id, "")
            ).rejects.toThrow("eName is required");

            await expect(
                service.findMetaEnvelopesByOntology("Test", "")
            ).rejects.toThrow("eName is required");

            await expect(
                service.findMetaEnvelopesBySearchTerm("Test", "test", "")
            ).rejects.toThrow("eName is required");

            await expect(
                service.deleteMetaEnvelope(metaEnvelope.metaEnvelope.id, "")
            ).rejects.toThrow("eName is required");

            await expect(
                service.updateEnvelopeValue(metaEnvelope.envelopes[0].id, "new", "")
            ).rejects.toThrow("eName is required");
        });
    });
});
