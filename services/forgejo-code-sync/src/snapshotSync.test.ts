import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
    EVaultClient,
    RepoSnapshotEnvelopePayload,
} from "./evault/client.js";
import type { IdentityResolver } from "./identity.js";
import { Queue } from "./queue.js";
import { RepoEnvelopeStore } from "./repoEnvelopeStore.js";
import { type SnapshotDrainDeps, processSnapshotTask } from "./snapshotSync.js";
import type { RepoSnapshotTask } from "./task.js";

let dir: string;
let storeDir: string;
let queue: Queue<RepoSnapshotTask>;
let store: RepoEnvelopeStore;

const baseTask: RepoSnapshotTask = {
    repoFullName: "alice/repo",
    repoPrivate: false,
    ref: "refs/heads/main",
    ownerLogin: "alice",
    headCommitId: "abc123",
};

beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), "forgejo-code-sync-snapshot-"));
    storeDir = await mkdtemp(
        path.join(tmpdir(), "forgejo-code-sync-snapshot-store-"),
    );
    queue = new Queue<RepoSnapshotTask>({ dir });
    await queue.init();
    store = new RepoEnvelopeStore({ dir: storeDir });
    await store.init();
});

afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
    await rm(storeDir, { recursive: true, force: true });
});

function makeDeps(
    overrides: Partial<SnapshotDrainDeps> = {},
): SnapshotDrainDeps {
    const identity = {
        resolveEname: vi.fn().mockResolvedValue("@alice"),
    } as unknown as IdentityResolver;

    const evault = {
        writeRepoSnapshot: vi.fn().mockResolvedValue("snapshot-envelope-1"),
    } as unknown as EVaultClient;

    const fetchArchive = vi
        .fn()
        .mockResolvedValue("https://s3.example.org/repos/alice/repo.zip");

    return {
        queue,
        identity,
        evault,
        fetchArchive,
        store,
        now: () => new Date("2026-08-15T12:00:00.000Z"),
        ...overrides,
    };
}

describe("processSnapshotTask", () => {
    it('writes with acl ["*"] for a public repo, creating (no existing envelope id)', async () => {
        const id = await queue.enqueue(baseTask);
        const deps = makeDeps();

        const outcome = await processSnapshotTask(id, baseTask, deps);

        expect(outcome).toEqual({
            kind: "succeeded",
            envelopeId: "snapshot-envelope-1",
        });
        expect(deps.evault.writeRepoSnapshot).toHaveBeenCalledWith(
            "@alice",
            expect.objectContaining({
                repo: "alice/repo",
                headCommitId: "abc123",
                ownerEName: "@alice",
                updatedAt: "2026-08-15T12:00:00.000Z",
            }),
            ["*"],
            null,
        );
        expect(await queue.list()).toEqual([]);
    });

    it("writes with an owner-only acl for a private repo", async () => {
        const privateTask = { ...baseTask, repoPrivate: true };
        const id = await queue.enqueue(privateTask);
        const deps = makeDeps();

        await processSnapshotTask(id, privateTask, deps);

        expect(deps.evault.writeRepoSnapshot).toHaveBeenCalledWith(
            "@alice",
            expect.anything(),
            ["@alice"],
            null,
        );
    });

    it("passes the existing envelope id through when this repo already has a recorded snapshot - update, not create", async () => {
        await store.set("alice/repo", "existing-envelope-id");
        const id = await queue.enqueue(baseTask);
        const deps = makeDeps();

        await processSnapshotTask(id, baseTask, deps);

        expect(deps.evault.writeRepoSnapshot).toHaveBeenCalledWith(
            "@alice",
            expect.anything(),
            ["*"],
            "existing-envelope-id",
        );
    });

    it("records the returned envelope id in the store after a successful write", async () => {
        const id = await queue.enqueue(baseTask);
        const deps = makeDeps();

        await processSnapshotTask(id, baseTask, deps);

        expect(await store.get("alice/repo")).toBe("snapshot-envelope-1");
    });

    it("marks an unlinked owner's task done-and-skipped, never calling writeRepoSnapshot - covers both an ordinary unlinked account and an org-owned repo", async () => {
        const id = await queue.enqueue(baseTask);
        const deps = makeDeps({
            identity: {
                resolveEname: vi.fn().mockResolvedValue(null),
            } as unknown as IdentityResolver,
        });

        const outcome = await processSnapshotTask(id, baseTask, deps);

        expect(outcome).toEqual({ kind: "skipped" });
        expect(deps.evault.writeRepoSnapshot).not.toHaveBeenCalled();
        expect(await queue.list()).toEqual([]);
        expect(await store.get("alice/repo")).toBeNull();
    });

    it("leaves a task in the queue for retry on an eVault write failure, rather than dropping it", async () => {
        const id = await queue.enqueue(baseTask);
        const deps = makeDeps({
            evault: {
                writeRepoSnapshot: vi
                    .fn()
                    .mockRejectedValue(new Error("eVault down")),
            } as unknown as EVaultClient,
        });

        const outcome = await processSnapshotTask(id, baseTask, deps);

        expect(outcome.kind).toBe("failed");
        const [task] = await queue.list();
        expect(task?.status).toBe("retrying");
        expect(task?.lastError).toBe("eVault down");
        // Never recorded - the write never actually succeeded.
        expect(await store.get("alice/repo")).toBeNull();
    });

    it("marks the task failed, not skipped, when identity resolution itself errors", async () => {
        const id = await queue.enqueue(baseTask);
        const deps = makeDeps({
            identity: {
                resolveEname: vi
                    .fn()
                    .mockRejectedValue(
                        new Error("GET /users failed: HTTP 500"),
                    ),
            } as unknown as IdentityResolver,
        });

        const outcome = await processSnapshotTask(id, baseTask, deps);

        expect(outcome.kind).toBe("failed");
        expect(deps.evault.writeRepoSnapshot).not.toHaveBeenCalled();
        const [task] = await queue.list();
        expect(task?.status).toBe("retrying");
    });

    it("leaves a task in the queue for retry when the archive fetch/upload fails", async () => {
        const id = await queue.enqueue(baseTask);
        const deps = makeDeps({
            fetchArchive: vi
                .fn()
                .mockRejectedValue(new Error("S3 unreachable")),
        });

        const outcome = await processSnapshotTask(id, baseTask, deps);

        expect(outcome.kind).toBe("failed");
        expect(deps.evault.writeRepoSnapshot).not.toHaveBeenCalled();
        const [task] = await queue.list();
        expect(task?.status).toBe("retrying");
        expect(task?.lastError).toBe("S3 unreachable");
    });

    it("calls fetchArchive with the task itself", async () => {
        const id = await queue.enqueue(baseTask);
        const deps = makeDeps();

        await processSnapshotTask(id, baseTask, deps);

        expect(deps.fetchArchive).toHaveBeenCalledWith(baseTask);
    });

    it("resolves eName from ownerLogin, not any pusher field", async () => {
        const id = await queue.enqueue(baseTask);
        const deps = makeDeps();

        await processSnapshotTask(id, baseTask, deps);

        expect(deps.identity.resolveEname).toHaveBeenCalledWith("alice");
    });

    it("calls onOutcome for every outcome kind", async () => {
        const id = await queue.enqueue(baseTask);
        const onOutcome = vi.fn();
        const deps = makeDeps({ onOutcome });

        await processSnapshotTask(id, baseTask, deps);

        expect(onOutcome).toHaveBeenCalledWith(
            id,
            baseTask,
            expect.objectContaining({ kind: "succeeded" }),
        );
    });

    it("passes the fetched snapshotUrl through to the written payload", async () => {
        const id = await queue.enqueue(baseTask);
        const deps = makeDeps({
            fetchArchive: vi
                .fn()
                .mockResolvedValue("https://example.org/archive.zip"),
        });

        await processSnapshotTask(id, baseTask, deps);

        const call = (deps.evault.writeRepoSnapshot as ReturnType<typeof vi.fn>)
            .mock.calls[0] as [
            string,
            RepoSnapshotEnvelopePayload,
            string[],
            string | null,
        ];
        expect(call[1].snapshotUrl).toBe("https://example.org/archive.zip");
    });
});
