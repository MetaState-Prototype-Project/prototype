import { beforeEach, describe, expect, it } from "vitest";
import { Web3Adapter } from "../adapter.js";

const EVaultEndpoint = "http://localhost:4000/graphql";

async function queryGraphQL(
    query: string,
    variables: Record<string, unknown> = {},
) {
    const response = await fetch(EVaultEndpoint, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ query, variables }),
    });
    return response.json();
}

describe("eVault Integration", () => {
    let adapter: Web3Adapter;
    let storedId: string;

    beforeEach(() => {
        adapter = new Web3Adapter();
    });

    it("should store and retrieve data from eVault", async () => {
        // Register mappings for a platform
        adapter.registerMapping("twitter", [
            { sourceField: "tweet", targetField: "text" },
            { sourceField: "likes", targetField: "userLikes" },
            { sourceField: "replies", targetField: "interactions" },
            { sourceField: "image", targetField: "image" },
            {
                sourceField: "timestamp",
                targetField: "dateCreated",
                transform: (value: number) => new Date(value).toISOString(),
            },
        ]);

        // Create platform-specific data
        const twitterData = {
            tweet: "Hello world!",
            likes: ["@user1", "@user2"],
            replies: ["reply1", "reply2"],
            image: "https://example.com/image.jpg",
        };

        // Convert to universal format
        const universalData = adapter.toUniversal("twitter", twitterData);

        // Store in eVault
        const storeMutation = `
      mutation StoreMetaEnvelope($input: MetaEnvelopeInput!) {
        storeMetaEnvelope(input: $input) {
          metaEnvelope {
            id
            ontology
            parsed
          }
        }
      }
    `;

        const storeResult = await queryGraphQL(storeMutation, {
            input: {
                ontology: "SocialMediaPost",
                payload: universalData,
                acl: ["*"],
            },
        });

        expect(storeResult.errors).toBeUndefined();
        expect(
            storeResult.data.storeMetaEnvelope.metaEnvelope.id,
        ).toBeDefined();
        storedId = storeResult.data.storeMetaEnvelope.metaEnvelope.id;

        // Retrieve from eVault
        const retrieveQuery = `
      query GetMetaEnvelope($id: String!) {
        getMetaEnvelopeById(id: $id) {
          parsed
        }
      }
    `;

        const retrieveResult = await queryGraphQL(retrieveQuery, {
            id: storedId,
        });
        expect(retrieveResult.errors).toBeUndefined();
        const retrievedData = retrieveResult.data.getMetaEnvelopeById.parsed;

        // Convert back to platform format
        const platformData = adapter.fromUniversal("twitter", retrievedData);
    });

    it("should exchange data between different platforms", async () => {
        // Register mappings for Platform A (Twitter-like)
        adapter.registerMapping("platformA", [
            { sourceField: "post", targetField: "text" },
            { sourceField: "reactions", targetField: "userLikes" },
            { sourceField: "comments", targetField: "interactions" },
            { sourceField: "media", targetField: "image" },
            {
                sourceField: "createdAt",
                targetField: "dateCreated",
                transform: (value: number) => new Date(value).toISOString(),
            },
        ]);

        // Register mappings for Platform B (Facebook-like)
        adapter.registerMapping("platformB", [
            { sourceField: "content", targetField: "text" },
            { sourceField: "likes", targetField: "userLikes" },
            { sourceField: "responses", targetField: "interactions" },
            { sourceField: "attachment", targetField: "image" },
            {
                sourceField: "postedAt",
                targetField: "dateCreated",
                transform: (value: string) => new Date(value).getTime(),
            },
        ]);

        // Create data in Platform A format
        const platformAData = {
            post: "Cross-platform test post",
            reactions: ["user1", "user2"],
            comments: ["Great post!", "Thanks for sharing"],
            media: "https://example.com/cross-platform.jpg",
            createdAt: Date.now(),
        };

        // Convert Platform A data to universal format
        const universalData = adapter.toUniversal("platformA", platformAData);

        // Store in eVault
        const storeMutation = `
      mutation StoreMetaEnvelope($input: MetaEnvelopeInput!) {
        storeMetaEnvelope(input: $input) {
          metaEnvelope {
            id
            ontology
            parsed
          }
        }
      }
    `;

        const storeResult = await queryGraphQL(storeMutation, {
            input: {
                ontology: "SocialMediaPost",
                payload: universalData,
                acl: ["*"],
            },
        });

        expect(storeResult.errors).toBeUndefined();
        expect(
            storeResult.data.storeMetaEnvelope.metaEnvelope.id,
        ).toBeDefined();
        const storedId = storeResult.data.storeMetaEnvelope.metaEnvelope.id;

        // Retrieve from eVault
        const retrieveQuery = `
      query GetMetaEnvelope($id: String!) {
        getMetaEnvelopeById(id: $id) {
          parsed
        }
      }
    `;

        const retrieveResult = await queryGraphQL(retrieveQuery, {
            id: storedId,
        });
        expect(retrieveResult.errors).toBeUndefined();
        const retrievedData = retrieveResult.data.getMetaEnvelopeById.parsed;

        // Convert to Platform B format
        const platformBData = adapter.fromUniversal("platformB", retrievedData);

        // Verify Platform B data structure
        expect(platformBData).toEqual({
            content: platformAData.post,
            likes: platformAData.reactions,
            responses: platformAData.comments,
            attachment: platformAData.media,
            postedAt: expect.any(Number), // We expect a timestamp
        });

        // Verify data integrity
        expect(platformBData.content).toBe(platformAData.post);
        expect(platformBData.likes).toEqual(platformAData.reactions);
        expect(platformBData.responses).toEqual(platformAData.comments);
        expect(platformBData.attachment).toBe(platformAData.media);
    });

    it("should search data in eVault", async () => {
        // Register mappings for a platform
        adapter.registerMapping("twitter", [
            { sourceField: "tweet", targetField: "text" },
            { sourceField: "likes", targetField: "userLikes" },
        ]);

        // Create and store test data
        const twitterData = {
            tweet: "Searchable content",
            likes: ["@user1"],
        };

        const universalData = adapter.toUniversal("twitter", twitterData);

        const storeMutation = `
            mutation Store($input: MetaEnvelopeInput!) {
                storeMetaEnvelope(input: $input) {
                    metaEnvelope {
                        id
                    }
                }
            }
        `;

        await queryGraphQL(storeMutation, {
            input: {
                ontology: "SocialMediaPost",
                payload: universalData,
                acl: ["*"],
            },
        });

        // Search in eVault
        const searchQuery = `
            query Search($ontology: String!, $term: String!) {
                searchMetaEnvelopes(ontology: $ontology, term: $term) {
                    id
                    parsed
                }
            }
        `;

        const searchResult = await queryGraphQL(searchQuery, {
            ontology: "SocialMediaPost",
            term: "Searchable",
        });

        expect(searchResult.errors).toBeUndefined();
        expect(searchResult.data.searchMetaEnvelopes.length).toBeGreaterThan(0);
        expect(searchResult.data.searchMetaEnvelopes[0].parsed.text).toBe(
            "Searchable content",
        );
    });
});
