import { describe, it, expect, vi, beforeAll } from "vitest";
import { resolveEName, resolveENameSync, SchemaIds, configurePlatformUrls } from "../index.js";

// Configure test platform URLs (simulates what a platform does at startup)
beforeAll(() => {
    configurePlatformUrls({
        pictique: "http://localhost:5173",
        blabsy: "http://localhost:8080",
        "file-manager": "http://localhost:3005",
        esigner: "http://localhost:3006",
        evoting: "http://localhost:3000",
        dreamsync: "http://localhost:3007",
        ecurrency: "http://localhost:8989",
        ereputation: "http://localhost:8765",
        cerberus: "http://localhost:6666",
        "group-charter": "http://localhost:3002",
        emover: "http://localhost:3008",
    });
});

describe("resolveENameSync", () => {
    it("resolves a SocialMediaPost to Pictique and Blabsy", () => {
        const result = resolveENameSync({
            ename: "@test-user-uuid",
            schemaId: SchemaIds.SocialMediaPost,
            entityId: "post-123",
        });

        expect(result.ename).toBe("@test-user-uuid");
        expect(result.schemaId).toBe(SchemaIds.SocialMediaPost);
        expect(result.schemaLabel).toBe("Post");
        expect(result.apps).toHaveLength(2);

        const pictique = result.apps.find((a) => a.platformKey === "pictique");
        expect(pictique).toBeDefined();
        expect(pictique!.url).toContain("localhost:5173");
        expect(pictique!.url).toContain("/home");

        const blabsy = result.apps.find((a) => a.platformKey === "blabsy");
        expect(blabsy).toBeDefined();
        expect(blabsy!.url).toContain("localhost:8080");
        expect(blabsy!.url).toContain("/tweet/post-123");
    });

    it("resolves a File to File Manager and eSigner", () => {
        const result = resolveENameSync({
            ename: "@owner-uuid",
            schemaId: SchemaIds.File,
            entityId: "file-456",
        });

        expect(result.apps).toHaveLength(2);
        expect(result.schemaLabel).toBe("File");

        const fm = result.apps.find((a) => a.platformKey === "file-manager");
        expect(fm).toBeDefined();
        expect(fm!.url).toContain("/files/file-456");

        const es = result.apps.find((a) => a.platformKey === "esigner");
        expect(es).toBeDefined();
        expect(es!.url).toContain("/files/file-456");
    });

    it("resolves a Poll to eVoting and eReputation", () => {
        const result = resolveENameSync({
            ename: "@voter-uuid",
            schemaId: SchemaIds.Poll,
            entityId: "poll-789",
        });

        expect(result.apps).toHaveLength(2);
        expect(result.schemaLabel).toBe("Poll");

        const evoting = result.apps.find((a) => a.platformKey === "evoting");
        expect(evoting!.url).toContain("/poll-789");
    });

    it("returns empty apps for unknown schemaId", () => {
        const result = resolveENameSync({
            ename: "@user",
            schemaId: "unknown-schema-id",
        });

        expect(result.apps).toHaveLength(0);
        expect(result.schemaLabel).toBe("Unknown content type");
    });

    it("uses custom platform URLs when provided", () => {
        const result = resolveENameSync(
            {
                ename: "@user",
                schemaId: SchemaIds.SocialMediaPost,
                entityId: "tweet-1",
            },
            {
                blabsy: "https://blabsy.example.com",
                pictique: "https://pictique.example.com",
            },
        );

        const blabsy = result.apps.find((a) => a.platformKey === "blabsy");
        expect(blabsy!.url).toBe(
            "https://blabsy.example.com/tweet/tweet-1",
        );
    });

    it("resolves User schema to profile pages", () => {
        const result = resolveENameSync({
            ename: "@alice-uuid",
            schemaId: SchemaIds.User,
            entityId: "alice-id",
        });

        expect(result.apps).toHaveLength(2);
        expect(result.schemaLabel).toBe("User Profile");

        const pictique = result.apps.find((a) => a.platformKey === "pictique");
        expect(pictique!.url).toContain("/profile/alice-id");

        const blabsy = result.apps.find((a) => a.platformKey === "blabsy");
        expect(blabsy!.url).toContain("/user/alice-id");
    });

    it("resolves Ledger to eCurrency only", () => {
        const result = resolveENameSync({
            ename: "@user",
            schemaId: SchemaIds.Ledger,
        });

        expect(result.apps).toHaveLength(1);
        expect(result.apps[0].platformKey).toBe("ecurrency");
        expect(result.apps[0].url).toContain("/dashboard");
    });

    it("resolves Group to multiple platforms", () => {
        const result = resolveENameSync({
            ename: "@user",
            schemaId: SchemaIds.Group,
            entityId: "group-1",
        });

        expect(result.apps.length).toBeGreaterThanOrEqual(3);
        const keys = result.apps.map((a) => a.platformKey);
        expect(keys).toContain("pictique");
        expect(keys).toContain("blabsy");
        expect(keys).toContain("group-charter");
    });
});

describe("resolveEName (async)", () => {
    it("fetches platform URLs from registry", async () => {
        const mockFetch = vi.fn().mockResolvedValue({
            ok: true,
            json: () =>
                Promise.resolve([
                    "https://pictique.prod.example.com",
                    "https://blabsy.prod.example.com",
                    "https://charter.prod.example.com",
                    null, // Cerberus
                    null, // eVoting
                    null, // DreamSync
                    null, // eReputation
                    null, // eCurrency
                    null, // eMoving
                    null, // eSigner
                    null, // File Manager
                ]),
        });

        const result = await resolveEName(
            {
                ename: "@user",
                schemaId: SchemaIds.SocialMediaPost,
                entityId: "p-1",
            },
            {
                registryUrl: "https://registry.example.com",
                fetch: mockFetch as unknown as typeof globalThis.fetch,
            },
        );

        expect(mockFetch).toHaveBeenCalledWith(
            "https://registry.example.com/platforms",
        );

        const pictique = result.apps.find((a) => a.platformKey === "pictique");
        expect(pictique!.url).toBe("https://pictique.prod.example.com/home");

        const blabsy = result.apps.find((a) => a.platformKey === "blabsy");
        expect(blabsy!.url).toBe(
            "https://blabsy.prod.example.com/tweet/p-1",
        );
    });

    it("falls back to defaults when registry fails", async () => {
        const mockFetch = vi.fn().mockRejectedValue(new Error("network"));

        const result = await resolveEName(
            {
                ename: "@user",
                schemaId: SchemaIds.File,
                entityId: "f-1",
            },
            {
                registryUrl: "https://broken.example.com",
                fetch: mockFetch as unknown as typeof globalThis.fetch,
            },
        );

        // Should still resolve using default URLs
        expect(result.apps.length).toBeGreaterThan(0);
        const fm = result.apps.find((a) => a.platformKey === "file-manager");
        expect(fm!.url).toContain("localhost");
    });

    it("explicit platformUrls override registry", async () => {
        const mockFetch = vi.fn().mockResolvedValue({
            ok: true,
            json: () =>
                Promise.resolve([
                    "https://pictique.registry.com",
                    "https://blabsy.registry.com",
                ]),
        });

        const result = await resolveEName(
            {
                ename: "@user",
                schemaId: SchemaIds.SocialMediaPost,
                entityId: "x",
            },
            {
                registryUrl: "https://reg.example.com",
                fetch: mockFetch as unknown as typeof globalThis.fetch,
                platformUrls: {
                    blabsy: "https://blabsy.override.com",
                },
            },
        );

        const blabsy = result.apps.find((a) => a.platformKey === "blabsy");
        expect(blabsy!.url).toBe("https://blabsy.override.com/tweet/x");

        // Pictique should come from registry
        const pictique = result.apps.find((a) => a.platformKey === "pictique");
        expect(pictique!.url).toBe("https://pictique.registry.com/home");
    });
});
