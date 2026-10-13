import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Queue } from "./queue.js";

interface TestPayload {
    commitId: string;
}

let dir: string;

beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), "forgejo-code-sync-queue-"));
});

afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
});

describe("Queue", () => {
    it("enqueues a task as pending, immediately due", async () => {
        const queue = new Queue<TestPayload>({ dir });
        await queue.init();

        const id = await queue.enqueue({ commitId: "abc123" });

        const due = await queue.due();
        expect(due).toHaveLength(1);
        expect(due[0]?.id).toBe(id);
        expect(due[0]?.status).toBe("pending");
        expect(due[0]?.attempts).toBe(0);
    });

    it("removes a task on success", async () => {
        const queue = new Queue<TestPayload>({ dir });
        await queue.init();
        const id = await queue.enqueue({ commitId: "abc123" });

        await queue.markSucceeded(id);

        expect(await queue.list()).toEqual([]);
    });

    it("removes a task on skip, distinctly from a failure", async () => {
        const queue = new Queue<TestPayload>({ dir });
        await queue.init();
        const id = await queue.enqueue({ commitId: "abc123" });

        await queue.markSkipped(id);

        // A skipped task is gone, not lingering in any retryable status - it
        // must never be confused with something still pending or retrying.
        expect(await queue.list()).toEqual([]);
    });

    it("retries a failed task with backoff, not dropping it", async () => {
        const queue = new Queue<TestPayload>({
            dir,
            maxAttempts: 5,
            baseDelayMs: 1000,
        });
        await queue.init();
        const id = await queue.enqueue({ commitId: "abc123" });

        const now = Date.now();
        const status = await queue.markFailed(
            id,
            new Error("eVault down"),
            now,
        );

        expect(status).toBe("retrying");
        const [task] = await queue.list();
        expect(task?.status).toBe("retrying");
        expect(task?.attempts).toBe(1);
        expect(task?.lastError).toBe("eVault down");
        // Backoff: baseDelayMs * 2^(attempts-1) = 1000 * 2^0 = 1000
        expect(task?.nextAttemptAt).toBe(now + 1000);

        // Not due yet - the queue must not hand back a task before its backoff
        // has elapsed.
        expect(await queue.due(now)).toEqual([]);
        expect(await queue.due(now + 1000)).toHaveLength(1);
    });

    it("increases the backoff exponentially across repeated failures", async () => {
        const queue = new Queue<TestPayload>({
            dir,
            maxAttempts: 10,
            baseDelayMs: 1000,
        });
        await queue.init();
        const id = await queue.enqueue({ commitId: "abc123" });

        const now = Date.now();
        await queue.markFailed(id, "err", now);
        await queue.markFailed(id, "err", now);
        const status = await queue.markFailed(id, "err", now);

        expect(status).toBe("retrying");
        const [task] = await queue.list();
        expect(task?.attempts).toBe(3);
        // baseDelayMs * 2^(3-1) = 1000 * 4 = 4000
        expect(task?.nextAttemptAt).toBe(now + 4000);
    });

    it("marks a task exhausted, not silently removed, once retries run out", async () => {
        const queue = new Queue<TestPayload>({ dir, maxAttempts: 2 });
        await queue.init();
        const id = await queue.enqueue({ commitId: "abc123" });

        await queue.markFailed(id, "err");
        const status = await queue.markFailed(id, "final failure");

        expect(status).toBe("exhausted");
        const [task] = await queue.list();
        expect(task).toBeDefined();
        expect(task?.status).toBe("exhausted");
        expect(task?.lastError).toBe("final failure");
    });

    it("never hands an exhausted task back from due()", async () => {
        const queue = new Queue<TestPayload>({ dir, maxAttempts: 1 });
        await queue.init();
        const id = await queue.enqueue({ commitId: "abc123" });

        await queue.markFailed(id, "err");

        expect(await queue.due()).toEqual([]);
        // But it is still findable via list() - exhausted tasks need a human,
        // not to vanish.
        expect(await queue.list()).toHaveLength(1);
    });

    it("survives a simulated restart - a new Queue instance sees prior state", async () => {
        const first = new Queue<TestPayload>({ dir });
        await first.init();
        const id = await first.enqueue({ commitId: "abc123" });

        // Simulate a process restart: a brand new Queue instance, same dir, no
        // in-memory state carried over.
        const second = new Queue<TestPayload>({ dir });
        const due = await second.due();

        expect(due).toHaveLength(1);
        expect(due[0]?.id).toBe(id);
    });

    it("returns an empty list when the directory has not been initialised yet", async () => {
        const queue = new Queue<TestPayload>({
            dir: path.join(dir, "not-created"),
        });
        expect(await queue.list()).toEqual([]);
        expect(await queue.due()).toEqual([]);
    });
});
