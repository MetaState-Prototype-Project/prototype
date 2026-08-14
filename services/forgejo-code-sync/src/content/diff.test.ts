import { describe, expect, it, vi } from "vitest";
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

describe("createDiffFetcher", () => {
    it("inlines a diff under the cap", async () => {
        const diffText = "diff --git a/a.ts b/a.ts\n+hello\n";
        const fetchImpl = vi
            .fn()
            .mockResolvedValue(new Response(diffText, { status: 200 }));
        const fetchDiff = createDiffFetcher({
            forgejoApiUrl: "https://git.example.org",
            adminToken: "admin-token",
            maxBytes: 1000,
            fetchImpl,
        });

        const result = await fetchDiff(task);

        expect(result).toEqual({ diff: diffText, diffUrl: null });
        expect(fetchImpl).toHaveBeenCalledWith(
            "https://git.example.org/alice/repo/commit/abc123.diff",
            { headers: { Authorization: "token admin-token" } },
        );
    });

    it("falls back to diffUrl, with no diff field, when the diff exceeds the cap", async () => {
        const bigDiff = "x".repeat(2000);
        const fetchImpl = vi
            .fn()
            .mockResolvedValue(new Response(bigDiff, { status: 200 }));
        const fetchDiff = createDiffFetcher({
            forgejoApiUrl: "https://git.example.org",
            adminToken: "admin-token",
            maxBytes: 1000,
            fetchImpl,
        });

        const result = await fetchDiff(task);

        expect(result.diff).toBeNull();
        expect(result.diffUrl).toBe(task.commitUrl);
    });

    it("falls back to diffUrl on a non-2xx response, without throwing", async () => {
        const fetchImpl = vi
            .fn()
            .mockResolvedValue(new Response(null, { status: 404 }));
        const fetchDiff = createDiffFetcher({
            forgejoApiUrl: "https://git.example.org",
            adminToken: "admin-token",
            maxBytes: 1000,
            fetchImpl,
        });

        const result = await fetchDiff(task);

        expect(result).toEqual({ diff: null, diffUrl: task.commitUrl });
    });

    it("falls back to diffUrl on a network failure, without throwing", async () => {
        const fetchImpl = vi.fn().mockRejectedValue(new Error("ECONNREFUSED"));
        const fetchDiff = createDiffFetcher({
            forgejoApiUrl: "https://git.example.org",
            adminToken: "admin-token",
            maxBytes: 1000,
            fetchImpl,
        });

        await expect(fetchDiff(task)).resolves.toEqual({
            diff: null,
            diffUrl: task.commitUrl,
        });
    });

    it("inlines a diff exactly at the cap", async () => {
        const diffText = "x".repeat(1000);
        const fetchImpl = vi
            .fn()
            .mockResolvedValue(new Response(diffText, { status: 200 }));
        const fetchDiff = createDiffFetcher({
            forgejoApiUrl: "https://git.example.org",
            adminToken: "admin-token",
            maxBytes: 1000,
            fetchImpl,
        });

        const result = await fetchDiff(task);

        expect(result.diff).toBe(diffText);
    });

    it("falls back to compareUrl when commitUrl is empty", async () => {
        const taskWithoutCommitUrl: CommitSyncTask = { ...task, commitUrl: "" };
        const fetchImpl = vi.fn().mockRejectedValue(new Error("ECONNREFUSED"));
        const fetchDiff = createDiffFetcher({
            forgejoApiUrl: "https://git.example.org",
            adminToken: "admin-token",
            maxBytes: 1000,
            fetchImpl,
        });

        const result = await fetchDiff(taskWithoutCommitUrl);

        expect(result.diffUrl).toBe(task.compareUrl);
    });
});
