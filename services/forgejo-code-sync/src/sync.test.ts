import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CommitEnvelopePayload, EVaultClient } from "./evault/client.js";
import type { IdentityResolver } from "./identity.js";
import { Queue } from "./queue.js";
import { type DrainDeps, processTask } from "./sync.js";
import type { CommitSyncTask } from "./task.js";

let dir: string;
let queue: Queue<CommitSyncTask>;

const baseTask: CommitSyncTask = {
    commitId: "abc123",
    repoFullName: "alice/repo",
    repoPrivate: false,
    ref: "refs/heads/main",
    pusherLogin: "alice",
    message: "a commit",
    committedAt: "2026-08-14T10:00:00Z",
    added: ["a.ts"],
    removed: [],
    modified: [],
    commitUrl: "https://git.example.org/alice/repo/commit/abc123",
    compareUrl: "https://git.example.org/alice/repo/compare/x...y",
};

beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), "forgejo-code-sync-sync-"));
    queue = new Queue<CommitSyncTask>({ dir });
    await queue.init();
});

afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
});

function makeDeps(overrides: Partial<DrainDeps> = {}): DrainDeps {
    const identity = {
        resolveEname: vi.fn().mockResolvedValue("@alice"),
    } as unknown as IdentityResolver;

    const evault = {
        writeCommit: vi.fn().mockResolvedValue("envelope-1"),
    } as unknown as EVaultClient;

    const fetchDiff = vi
        .fn()
        .mockResolvedValue(
            "https://s3.example.org/diffs/alice/repo/abc123.diff",
        );

    return { queue, identity, evault, fetchDiff, ...overrides };
}

describe("processTask", () => {
    it('writes to the eVault with acl ["*"] for a public repo', async () => {
        const id = await queue.enqueue(baseTask);
        const deps = makeDeps();

        const outcome = await processTask(id, baseTask, deps);

        expect(outcome).toEqual({
            kind: "succeeded",
            envelopeId: "envelope-1",
        });
        expect(deps.evault.writeCommit).toHaveBeenCalledWith(
            "@alice",
            expect.objectContaining({ id: "abc123", authorEName: "@alice" }),
            ["*"],
        );
        expect(await queue.list()).toEqual([]);
    });

    it("writes to the eVault with an owner-only acl for a private repo", async () => {
        const privateTask = { ...baseTask, repoPrivate: true };
        const id = await queue.enqueue(privateTask);
        const deps = makeDeps();

        await processTask(id, privateTask, deps);

        expect(deps.evault.writeCommit).toHaveBeenCalledWith(
            "@alice",
            expect.anything(),
            ["@alice"],
        );
    });

    it("marks an unlinked pusher's task done-and-skipped, never calling writeCommit", async () => {
        const id = await queue.enqueue(baseTask);
        const deps = makeDeps({
            identity: {
                resolveEname: vi.fn().mockResolvedValue(null),
            } as unknown as IdentityResolver,
        });

        const outcome = await processTask(id, baseTask, deps);

        expect(outcome).toEqual({ kind: "skipped" });
        expect(deps.evault.writeCommit).not.toHaveBeenCalled();
        // Gone from the queue, same as a success - not lingering as pending/retrying.
        expect(await queue.list()).toEqual([]);
    });

    it("leaves a task in the queue for retry on an eVault write failure, rather than dropping it", async () => {
        const id = await queue.enqueue(baseTask);
        const deps = makeDeps({
            evault: {
                writeCommit: vi
                    .fn()
                    .mockRejectedValue(new Error("eVault down")),
            } as unknown as EVaultClient,
        });

        const outcome = await processTask(id, baseTask, deps);

        expect(outcome.kind).toBe("failed");
        const [task] = await queue.list();
        expect(task).toBeDefined();
        expect(task?.status).toBe("retrying");
        expect(task?.lastError).toBe("eVault down");
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

        const outcome = await processTask(id, baseTask, deps);

        expect(outcome.kind).toBe("failed");
        expect(deps.evault.writeCommit).not.toHaveBeenCalled();
        const [task] = await queue.list();
        expect(task?.status).toBe("retrying");
    });

    it("passes the fetched diffUrl through to the written payload", async () => {
        const id = await queue.enqueue(baseTask);
        const deps = makeDeps({
            fetchDiff: vi.fn().mockResolvedValue("https://example.org/diff"),
        });

        await processTask(id, baseTask, deps);

        const call = (deps.evault.writeCommit as ReturnType<typeof vi.fn>).mock
            .calls[0] as [string, CommitEnvelopePayload, string[]];
        expect(call[1].diffUrl).toBe("https://example.org/diff");
    });

    it("calls fetchDiff with the task and the resolved eName", async () => {
        const id = await queue.enqueue(baseTask);
        const deps = makeDeps();

        await processTask(id, baseTask, deps);

        expect(deps.fetchDiff).toHaveBeenCalledWith(baseTask, "@alice");
    });

    it("leaves a task in the queue for retry when the diff fetch/upload fails", async () => {
        const id = await queue.enqueue(baseTask);
        const deps = makeDeps({
            fetchDiff: vi.fn().mockRejectedValue(new Error("S3 unreachable")),
        });

        const outcome = await processTask(id, baseTask, deps);

        expect(outcome.kind).toBe("failed");
        expect(deps.evault.writeCommit).not.toHaveBeenCalled();
        const [task] = await queue.list();
        expect(task?.status).toBe("retrying");
        expect(task?.lastError).toBe("S3 unreachable");
    });

    it("calls onOutcome for every outcome kind", async () => {
        const id = await queue.enqueue(baseTask);
        const onOutcome = vi.fn();
        const deps = makeDeps({ onOutcome });

        await processTask(id, baseTask, deps);

        expect(onOutcome).toHaveBeenCalledWith(
            id,
            baseTask,
            expect.objectContaining({ kind: "succeeded" }),
        );
    });
});
