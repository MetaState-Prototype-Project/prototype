import { describe, expect, it, vi } from "vitest";
import type { S3Storage } from "../storage/s3.js";
import type { RepoSnapshotTask } from "../task.js";
import { createArchiveFetcher } from "./archive.js";

const task: RepoSnapshotTask = {
    repoFullName: "alice/repo",
    repoPrivate: false,
    ref: "refs/heads/main",
    ownerLogin: "alice",
    headCommitId: "abc123",
};

function fakeStorage(
    uploadRepoArchive = vi
        .fn()
        .mockResolvedValue("https://s3.example.org/repos/alice/repo.zip"),
) {
    return { uploadRepoArchive } as unknown as S3Storage;
}

describe("createArchiveFetcher", () => {
    it("fetches from the API router's archive/{sha}.zip route, using the push's headCommitId as the ref", async () => {
        const fetchImpl = vi
            .fn()
            .mockResolvedValue(new Response(new Uint8Array([1, 2, 3])));
        const storage = fakeStorage();
        const fetchArchive = createArchiveFetcher({
            forgejoApiUrl: "https://git.example.org",
            adminToken: "admin-token",
            storage,
            fetchImpl,
        });

        await fetchArchive(task);

        expect(fetchImpl).toHaveBeenCalledWith(
            "https://git.example.org/api/v1/repos/alice/repo/archive/abc123.zip",
            { headers: { Authorization: "token admin-token" } },
        );
    });

    it("uploads the fetched archive bytes to S3 and returns the resulting URL", async () => {
        const archiveBytes = new Uint8Array([80, 75, 3, 4]); // zip magic bytes
        const fetchImpl = vi.fn().mockResolvedValue(new Response(archiveBytes));
        const uploadRepoArchive = vi
            .fn()
            .mockResolvedValue("https://s3.example.org/repos/alice/repo.zip");
        const fetchArchive = createArchiveFetcher({
            forgejoApiUrl: "https://git.example.org",
            adminToken: "admin-token",
            storage: fakeStorage(uploadRepoArchive),
            fetchImpl,
        });

        const url = await fetchArchive(task);

        expect(url).toBe("https://s3.example.org/repos/alice/repo.zip");
        expect(uploadRepoArchive).toHaveBeenCalledWith(
            "alice/repo",
            expect.any(Buffer),
            true, // !task.repoPrivate
        );
    });

    it("uploads with isPublic=false for a private repo", async () => {
        const fetchImpl = vi
            .fn()
            .mockResolvedValue(new Response(new Uint8Array([1])));
        const uploadRepoArchive = vi
            .fn()
            .mockResolvedValue("https://s3.example.org/x");
        const fetchArchive = createArchiveFetcher({
            forgejoApiUrl: "https://git.example.org",
            adminToken: "admin-token",
            storage: fakeStorage(uploadRepoArchive),
            fetchImpl,
        });

        await fetchArchive({ ...task, repoPrivate: true });

        expect(uploadRepoArchive).toHaveBeenCalledWith(
            "alice/repo",
            expect.any(Buffer),
            false,
        );
    });

    it("throws on a non-2xx response, rather than degrading to a fallback", async () => {
        const fetchImpl = vi
            .fn()
            .mockResolvedValue(new Response(null, { status: 404 }));
        const fetchArchive = createArchiveFetcher({
            forgejoApiUrl: "https://git.example.org",
            adminToken: "admin-token",
            storage: fakeStorage(),
            fetchImpl,
        });

        await expect(fetchArchive(task)).rejects.toThrow(/404/);
    });

    it("throws on a network failure, rather than degrading to a fallback", async () => {
        const fetchImpl = vi.fn().mockRejectedValue(new Error("ECONNREFUSED"));
        const fetchArchive = createArchiveFetcher({
            forgejoApiUrl: "https://git.example.org",
            adminToken: "admin-token",
            storage: fakeStorage(),
            fetchImpl,
        });

        await expect(fetchArchive(task)).rejects.toThrow("ECONNREFUSED");
    });

    it("throws when the S3 upload itself fails", async () => {
        const fetchImpl = vi
            .fn()
            .mockResolvedValue(new Response(new Uint8Array([1])));
        const uploadRepoArchive = vi
            .fn()
            .mockRejectedValue(new Error("bucket unreachable"));
        const fetchArchive = createArchiveFetcher({
            forgejoApiUrl: "https://git.example.org",
            adminToken: "admin-token",
            storage: fakeStorage(uploadRepoArchive),
            fetchImpl,
        });

        await expect(fetchArchive(task)).rejects.toThrow("bucket unreachable");
    });
});
