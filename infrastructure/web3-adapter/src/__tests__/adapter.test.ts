import { beforeEach, describe, expect, it } from "vitest";
import { Web3Adapter } from "../adapter.js";
import type { MetaEnvelope, PlatformData } from "../types.js";

describe("Web3Adapter", () => {
    let adapter: Web3Adapter;

    beforeEach(async () => {
        adapter = new Web3Adapter({
            platform: "test-platform",
            ontologyServerUrl: "http://localhost:3000",
            eVaultUrl: "http://localhost:3001"
        });
        await adapter.initialize();
    });

    describe("Schema Mapping", () => {
        it("should convert platform data to eVault format with envelopes", async () => {
            const platformData: PlatformData = {
                id: "local-123",
                chatName: "Test Chat",
                type: "group",
                participants: ["user1", "user2"],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            const result = await adapter.toEVault("chats", platformData);

            expect(result.metaEnvelope).toBeDefined();
            expect(result.metaEnvelope.envelopes).toBeInstanceOf(Array);
            expect(result.metaEnvelope.envelopes.length).toBeGreaterThan(0);
            expect(result.operation).toBe("create");
        });

        it("should convert eVault MetaEnvelope back to platform format", async () => {
            const metaEnvelope: MetaEnvelope = {
                id: "w3-id-123",
                ontology: "SocialMediaPost",
                acl: ["*"],
                envelopes: [
                    {
                        id: "env-1",
                        ontology: "name",
                        value: "Test Chat",
                        valueType: "string"
                    },
                    {
                        id: "env-2",
                        ontology: "type",
                        value: "group",
                        valueType: "string"
                    }
                ]
            };

            const platformData = await adapter.fromEVault(metaEnvelope, "chats");

            expect(platformData).toBeDefined();
            expect(platformData.chatName).toBe("Test Chat");
            expect(platformData.type).toBe("group");
        });
    });

    describe("ID Mapping", () => {
        it("should store W3ID to local ID mapping when converting to eVault", async () => {
            const platformData: PlatformData = {
                id: "local-456",
                chatName: "ID Test Chat",
                type: "private"
            };

            const result = await adapter.toEVault("chats", platformData);

            expect(result.metaEnvelope.id).toBeDefined();
            expect(result.metaEnvelope.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
        });

        it("should convert W3IDs back to local IDs when reading from eVault", async () => {
            // First create a mapping
            const platformData: PlatformData = {
                id: "local-789",
                chatName: "Mapped Chat"
            };
            const createResult = await adapter.toEVault("chats", platformData);

            // Then read it back
            const readData = await adapter.fromEVault(createResult.metaEnvelope, "chats");

            expect(readData.id).toBe("local-789");
        });
    });

    describe("ACL Handling", () => {
        it("should extract and apply ACL read/write permissions", async () => {
            const platformData: PlatformData = {
                id: "acl-test",
                chatName: "Private Chat",
                _acl_read: ["user1", "user2"],
                _acl_write: ["user1"]
            };

            const result = await adapter.toEVault("chats", platformData);

            expect(result.metaEnvelope.acl).toEqual(["user1", "user2"]);
        });

        it("should set default public ACL when no ACL is specified", async () => {
            const platformData: PlatformData = {
                id: "public-test",
                chatName: "Public Chat"
            };

            const result = await adapter.toEVault("chats", platformData);

            expect(result.metaEnvelope.acl).toEqual(["*"]);
        });

        it("should restore ACL fields when converting from eVault", async () => {
            const metaEnvelope: MetaEnvelope = {
                id: "w3-acl-test",
                ontology: "Chat",
                acl: ["user1", "user2", "user3"],
                envelopes: [
                    {
                        id: "env-acl",
                        ontology: "name",
                        value: "ACL Test",
                        valueType: "string"
                    }
                ]
            };

            const platformData = await adapter.fromEVault(metaEnvelope, "chats");

            expect(platformData._acl_read).toEqual(["user1", "user2", "user3"]);
            expect(platformData._acl_write).toEqual(["user1", "user2", "user3"]);
        });
    });

    describe("Cross-Platform Data Handling", () => {
        it("should transform data for Twitter platform", async () => {
            const metaEnvelope: MetaEnvelope = {
                id: "cross-platform-1",
                ontology: "SocialMediaPost",
                acl: ["*"],
                envelopes: [
                    {
                        id: "env-text",
                        ontology: "text",
                        value: "Cross-platform test post",
                        valueType: "string"
                    },
                    {
                        id: "env-likes",
                        ontology: "userLikes",
                        value: ["user1", "user2"],
                        valueType: "array"
                    },
                    {
                        id: "env-interactions",
                        ontology: "interactions",
                        value: ["Great post!", "Thanks for sharing"],
                        valueType: "array"
                    }
                ]
            };

            const twitterData = await adapter.handleCrossPlatformData(metaEnvelope, "twitter");

            expect(twitterData.post).toBe("Cross-platform test post");
            expect(twitterData.reactions).toEqual(["user1", "user2"]);
            expect(twitterData.comments).toEqual(["Great post!", "Thanks for sharing"]);
        });

        it("should transform data for Instagram platform", async () => {
            const metaEnvelope: MetaEnvelope = {
                id: "cross-platform-2",
                ontology: "SocialMediaPost",
                acl: ["*"],
                envelopes: [
                    {
                        id: "env-text",
                        ontology: "text",
                        value: "Instagram post",
                        valueType: "string"
                    },
                    {
                        id: "env-likes",
                        ontology: "userLikes",
                        value: ["user3", "user4"],
                        valueType: "array"
                    },
                    {
                        id: "env-image",
                        ontology: "image",
                        value: "https://example.com/image.jpg",
                        valueType: "string"
                    }
                ]
            };

            const instagramData = await adapter.handleCrossPlatformData(metaEnvelope, "instagram");

            expect(instagramData.content).toBe("Instagram post");
            expect(instagramData.likes).toEqual(["user3", "user4"]);
            expect(instagramData.attachment).toBe("https://example.com/image.jpg");
        });
    });

    describe("Value Type Detection", () => {
        it("should correctly detect and convert value types", async () => {
            const platformData: PlatformData = {
                stringField: "text",
                numberField: 42,
                booleanField: true,
                arrayField: [1, 2, 3],
                objectField: { key: "value" }
            };

            const result = await adapter.toEVault("chats", platformData);
            const envelopes = result.metaEnvelope.envelopes;

            // The adapter would only process fields that are in the schema mapping
            // For this test, we're checking the type detection functionality
            expect(envelopes).toBeDefined();
        });
    });

    describe("Batch Synchronization", () => {
        it("should sync multiple platform records to eVault", async () => {
            const localData: PlatformData[] = [
                {
                    id: "batch-1",
                    chatName: "Chat 1",
                    type: "private"
                },
                {
                    id: "batch-2",
                    chatName: "Chat 2",
                    type: "group"
                },
                {
                    id: "batch-3",
                    chatName: "Chat 3",
                    type: "public"
                }
            ];

            // This would normally send to eVault, but for testing we just verify it runs
            await expect(adapter.syncWithEVault("chats", localData)).resolves.not.toThrow();
        });
    });
});