import { beforeEach, describe, expect, it } from "vitest";
import { Web3Adapter } from "../adapter.js";

describe("Web3Adapter", () => {
    let adapter: Web3Adapter;

    beforeEach(() => {
        adapter = new Web3Adapter();
    });

    it("should transform platform data to universal format", () => {
        // Register mappings for a platform
        adapter.registerMapping("twitter", [
            { sourceField: "tweet", targetField: "content" },
            { sourceField: "likes", targetField: "reactions" },
            { sourceField: "replies", targetField: "comments" },
        ]);

        const twitterData = {
            tweet: "Hello world!",
            likes: 42,
            replies: ["user1", "user2"],
        };

        const universalData = adapter.toUniversal("twitter", twitterData);
        expect(universalData).toEqual({
            content: "Hello world!",
            reactions: 42,
            comments: ["user1", "user2"],
        });
    });

    it("should transform universal data to platform format", () => {
        // Register mappings for a platform
        adapter.registerMapping("instagram", [
            { sourceField: "caption", targetField: "content" },
            { sourceField: "hearts", targetField: "reactions" },
            { sourceField: "comments", targetField: "comments" },
        ]);

        const universalData = {
            content: "Hello world!",
            reactions: 42,
            comments: ["user1", "user2"],
        };

        const instagramData = adapter.fromUniversal("instagram", universalData);
        expect(instagramData).toEqual({
            caption: "Hello world!",
            hearts: 42,
            comments: ["user1", "user2"],
        });
    });

    it("should handle field transformations", () => {
        adapter.registerMapping("custom", [
            {
                sourceField: "timestamp",
                targetField: "date",
                transform: (value: number) => new Date(value).toISOString(),
            },
        ]);

        const customData = {
            timestamp: 1677721600000,
        };

        const universalData = adapter.toUniversal("custom", customData);
        expect(universalData).toEqual({
            date: "2023-03-02T01:46:40.000Z",
        });
    });
});
