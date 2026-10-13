import { randomUUID } from "node:crypto";
import {
    mkdir,
    readFile,
    readdir,
    rename,
    rm,
    writeFile,
} from "node:fs/promises";
import path from "node:path";

export type QueueTaskStatus = "pending" | "retrying" | "exhausted";

export interface QueueTask<T> {
    id: string;
    payload: T;
    status: QueueTaskStatus;
    attempts: number;
    /** Epoch ms. The task is not picked up by `due()` before this time. */
    nextAttemptAt: number;
    lastError?: string;
    createdAt: number;
}

export interface QueueOptions {
    /** Where task files are persisted. Must survive a process restart. */
    dir: string;
    maxAttempts?: number;
    /** Base delay for exponential backoff; doubled per attempt. */
    baseDelayMs?: number;
}

const DEFAULT_MAX_ATTEMPTS = 5;
const DEFAULT_BASE_DELAY_MS = 30_000;

/**
 * A persisted retry queue for commit-sync tasks.
 *
 * Exists because Forgejo has no automatic retry/redelivery of failed webhook
 * deliveries at all (confirmed against GitW3's `services/webhook/deliver.go` -
 * it records success/failure and stops; the only resend is a human clicking
 * "Replay" in the webhook history UI). So this service's own retry is the only
 * safety net a dropped delivery gets - see the spec's "Delivery reliability"
 * section. Every operation reads or writes the backing directory directly, with
 * no separate in-memory cache, so the queue's state IS the disk: a task queued
 * before a crash or restart is still there afterward, with no reload step needed.
 *
 * A task's terminal states are asymmetric on purpose. `markSucceeded` and
 * `markSkipped` both remove the task file - the work is done, and there is
 * nothing further to act on. `markFailed` keeps retrying with backoff while
 * attempts remain, but once exhausted the task is left on disk in the
 * "exhausted" status rather than removed: it needs a human, and staying
 * findable is what makes that possible. Silently deleting it would reproduce
 * exactly the invisible-data-loss failure mode this queue exists to prevent.
 */
export class Queue<T> {
    private readonly dir: string;
    private readonly maxAttempts: number;
    private readonly baseDelayMs: number;

    constructor(options: QueueOptions) {
        this.dir = options.dir;
        this.maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
        this.baseDelayMs = options.baseDelayMs ?? DEFAULT_BASE_DELAY_MS;
    }

    async init(): Promise<void> {
        await mkdir(this.dir, { recursive: true });
    }

    private filePath(id: string): string {
        return path.join(this.dir, `${id}.json`);
    }

    private async writeTask(task: QueueTask<T>): Promise<void> {
        // Write-then-rename so a crash mid-write can never leave a half-written,
        // unparseable task file behind - the rename is atomic on the same
        // filesystem, the write alone is not.
        const tmpPath = `${this.filePath(task.id)}.tmp`;
        await writeFile(tmpPath, JSON.stringify(task, null, 2));
        await rename(tmpPath, this.filePath(task.id));
    }

    private async readTask(id: string): Promise<QueueTask<T>> {
        const raw = await readFile(this.filePath(id), "utf8");
        return JSON.parse(raw) as QueueTask<T>;
    }

    async enqueue(payload: T, now = Date.now()): Promise<string> {
        const task: QueueTask<T> = {
            id: randomUUID(),
            payload,
            status: "pending",
            attempts: 0,
            nextAttemptAt: now,
            createdAt: now,
        };
        await this.writeTask(task);
        return task.id;
    }

    /** Every task currently persisted, in any status. For introspection and tests. */
    async list(): Promise<QueueTask<T>[]> {
        let files: string[];
        try {
            files = await readdir(this.dir);
        } catch {
            return [];
        }
        const tasks: QueueTask<T>[] = [];
        for (const file of files) {
            if (!file.endsWith(".json")) continue;
            const raw = await readFile(path.join(this.dir, file), "utf8");
            tasks.push(JSON.parse(raw) as QueueTask<T>);
        }
        return tasks;
    }

    /** Pending or retrying tasks whose backoff has elapsed - ready to process now. */
    async due(now = Date.now()): Promise<QueueTask<T>[]> {
        const tasks = await this.list();
        return tasks.filter(
            (task) =>
                (task.status === "pending" || task.status === "retrying") &&
                task.nextAttemptAt <= now,
        );
    }

    async markSucceeded(id: string): Promise<void> {
        await rm(this.filePath(id), { force: true });
    }

    /**
     * The task was resolved without ever being attempted against the eVault -
     * e.g. the pusher has no linked identity. Removed the same as a success: it
     * is done, not failed, and must not be confused with something still
     * pending or retrying by anything inspecting the queue's contents.
     */
    async markSkipped(id: string): Promise<void> {
        await rm(this.filePath(id), { force: true });
    }

    /**
     * The task failed. Rescheduled with exponential backoff while attempts
     * remain; left in "exhausted" status, on disk, once they don't. Returns the
     * resulting status so callers can decide how loudly to log it.
     */
    async markFailed(
        id: string,
        error: unknown,
        now = Date.now(),
    ): Promise<QueueTaskStatus> {
        const task = await this.readTask(id);
        task.attempts += 1;
        task.lastError = error instanceof Error ? error.message : String(error);

        if (task.attempts >= this.maxAttempts) {
            task.status = "exhausted";
        } else {
            task.status = "retrying";
            task.nextAttemptAt =
                now + this.baseDelayMs * 2 ** (task.attempts - 1);
        }

        await this.writeTask(task);
        return task.status;
    }
}
