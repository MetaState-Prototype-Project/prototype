import { describe, expect, it, vi } from "vitest";
import type { S3Storage } from "../storage/s3.js";
import type { CommitSyncTask } from "../task.js";
import { createDiffFetcher } from "./diff.js";

const task: CommitSyncTask = {
    commitId: "abc123",
    repoFullName: "alice/repo",
    repoPrivate: false,
    ref: "refs/heads/main",
    pusherLogin: "alice",
    message: "a commit",
    committedAt: "2026-08-14T10:00:00Z",
    added: [],
    removed: [],
    modified: [],
    commitUrl: "https://git.example.org/alice/repo/commit/abc123",
    compareUrl: "https://git.example.org/alice/repo/compare/x...y",
};

function fakeStorage(
    uploadDiff = vi
        .fn()
        .mockResolvedValue(
            "https://s3.example.org/diffs/alice/repo/abc123.diff",
        ),
) {
    return { uploadDiff } as unknown as S3Storage;
}

describe("createDiffFetcher", () => {
    it("fetches from the API router's git/commits/{sha}.diff route, not the web router's commit/{sha}.diff", async () => {
        const fetchImpl = vi
            .fn()
            .mockResolvedValue(
                new Response("diff --git a/a.ts b/a.ts", { status: 200 }),
            );
        const storage = fakeStorage();
        const fetchDiff = createDiffFetcher({
            forgejoApiUrl: "https://git.example.org",
            adminToken: "admin-token",
            storage,
            fetchImpl,
        });

        await fetchDiff(task, "@alice");

        expect(fetchImpl).toHaveBeenCalledWith(
            "https://git.example.org/api/v1/repos/alice/repo/git/commits/abc123.diff",
            { headers: { Authorization: "token admin-token" } },
        );
    });

    it("uploads the fetched diff text to S3 and returns the resulting URL", async () => {
        const diffText = "diff --git a/a.ts b/a.ts\n+hello\n";
        const fetchImpl = vi
            .fn()
            .mockResolvedValue(new Response(diffText, { status: 200 }));
        const uploadDiff = vi
            .fn()
            .mockResolvedValue(
                "https://s3.example.org/diffs/alice/repo/abc123.diff",
            );
        const fetchDiff = createDiffFetcher({
            forgejoApiUrl: "https://git.example.org",
            adminToken: "admin-token",
            storage: fakeStorage(uploadDiff),
            fetchImpl,
        });

        const url = await fetchDiff(task, "@alice");

        expect(url).toBe("https://s3.example.org/diffs/alice/repo/abc123.diff");
        expect(uploadDiff).toHaveBeenCalledWith(
            "@alice",
            "alice/repo",
            "abc123",
            diffText,
            true, // !task.repoPrivate
        );
    });

    it("uploads with isPublic=false for a private repo", async () => {
        const fetchImpl = vi
            .fn()
            .mockResolvedValue(new Response("diff", { status: 200 }));
        const uploadDiff = vi
            .fn()
            .mockResolvedValue("https://s3.example.org/x");
        const fetchDiff = createDiffFetcher({
            forgejoApiUrl: "https://git.example.org",
            adminToken: "admin-token",
            storage: fakeStorage(uploadDiff),
            fetchImpl,
        });

        await fetchDiff({ ...task, repoPrivate: true }, "@alice");

        expect(uploadDiff).toHaveBeenCalledWith(
            "@alice",
            "alice/repo",
            "abc123",
            "diff",
            false,
        );
    });

    it("throws on a non-2xx response, rather than degrading to a fallback", async () => {
        const fetchImpl = vi
            .fn()
            .mockResolvedValue(new Response(null, { status: 404 }));
        const fetchDiff = createDiffFetcher({
            forgejoApiUrl: "https://git.example.org",
            adminToken: "admin-token",
            storage: fakeStorage(),
            fetchImpl,
        });

        await expect(fetchDiff(task, "@alice")).rejects.toThrow(/404/);
    });

    it("throws on a network failure, rather than degrading to a fallback", async () => {
        const fetchImpl = vi.fn().mockRejectedValue(new Error("ECONNREFUSED"));
        const fetchDiff = createDiffFetcher({
            forgejoApiUrl: "https://git.example.org",
            adminToken: "admin-token",
            storage: fakeStorage(),
            fetchImpl,
        });

        await expect(fetchDiff(task, "@alice")).rejects.toThrow("ECONNREFUSED");
    });

    it("throws when the S3 upload itself fails", async () => {
        const fetchImpl = vi
            .fn()
            .mockResolvedValue(new Response("diff", { status: 200 }));
        const uploadDiff = vi
            .fn()
            .mockRejectedValue(new Error("bucket unreachable"));
        const fetchDiff = createDiffFetcher({
            forgejoApiUrl: "https://git.example.org",
            adminToken: "admin-token",
            storage: fakeStorage(uploadDiff),
            fetchImpl,
        });

        await expect(fetchDiff(task, "@alice")).rejects.toThrow(
            "bucket unreachable",
        );
    });
});
