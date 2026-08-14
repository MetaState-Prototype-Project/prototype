import { beforeEach, describe, expect, it, vi } from "vitest";

const sendMock = vi.fn().mockResolvedValue({});
let capturedCommands: unknown[] = [];

vi.mock("@aws-sdk/client-s3", () => {
    class PutObjectCommand {
        input: unknown;
        constructor(input: unknown) {
            this.input = input;
            capturedCommands.push(input);
        }
    }
    class S3Client {
        send = sendMock;
    }
    return { S3Client, PutObjectCommand };
});

const { S3Storage } = await import("./s3.js");

beforeEach(() => {
    sendMock.mockClear();
    capturedCommands = [];
});

const baseOptions = {
    endpoint: "https://nyc3.digitaloceanspaces.com",
    region: "nyc3",
    accessKeyId: "key",
    secretAccessKey: "secret",
    bucket: "my-bucket",
};

describe("S3Storage.buildKey", () => {
    it("scopes the key under the eName, sanitised", () => {
        expect(S3Storage.buildKey("@alice", "alice/repo", "abc123")).toBe(
            "diffs/alice/alice_repo/abc123.diff",
        );
    });
});

describe("S3Storage.uploadDiff", () => {
    it("uploads with public-read ACL for a public repo", async () => {
        const storage = new S3Storage(baseOptions);
        const url = await storage.uploadDiff(
            "@alice",
            "alice/repo",
            "abc123",
            "diff --git a/a.ts b/a.ts",
            true,
        );

        expect(sendMock).toHaveBeenCalledTimes(1);
        const input = capturedCommands[0] as Record<string, unknown>;
        expect(input.ACL).toBe("public-read");
        expect(input.Bucket).toBe("my-bucket");
        expect(url).toBe(
            "https://my-bucket.nyc3.digitaloceanspaces.com/diffs/alice/alice_repo/abc123.diff",
        );
    });

    it("uploads with no public ACL for a private repo - the object must not be publicly readable", async () => {
        const storage = new S3Storage(baseOptions);
        await storage.uploadDiff(
            "@alice",
            "alice/repo",
            "abc123",
            "diff --git a/a.ts b/a.ts",
            false,
        );

        const input = capturedCommands[0] as Record<string, unknown>;
        expect(input.ACL).toBeUndefined();
    });

    it("uses the configured CDN URL when provided, instead of the bucket sub-domain", async () => {
        const storage = new S3Storage({
            ...baseOptions,
            cdnUrl: "https://cdn.example.org",
        });
        const url = await storage.uploadDiff(
            "@alice",
            "alice/repo",
            "abc123",
            "diff",
            true,
        );

        expect(url).toBe(
            "https://cdn.example.org/diffs/alice/alice_repo/abc123.diff",
        );
    });
});
