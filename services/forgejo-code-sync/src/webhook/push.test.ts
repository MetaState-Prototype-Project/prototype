import { createHmac } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import express from "express";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Queue } from "../queue.js";
import type { CommitSyncTask } from "../task.js";
import { createPushHandlers } from "./push.js";

const secret = "test-secret";

function sign(body: string): string {
    return createHmac("sha256", secret).update(Buffer.from(body)).digest("hex");
}

let dir: string;
let queue: Queue<CommitSyncTask>;
let server: Server;
let url: string;

beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), "forgejo-code-sync-push-"));
    queue = new Queue<CommitSyncTask>({ dir });
    await queue.init();

    const app = express();
    app.post("/webhook", ...createPushHandlers(queue, secret));

    server = app.listen(0);
    await new Promise<void>((resolve) => server.once("listening", resolve));
    const { port } = server.address() as AddressInfo;
    url = `http://127.0.0.1:${port}/webhook`;
});

afterEach(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await rm(dir, { recursive: true, force: true });
});

const twoCommitPayload = {
    ref: "refs/heads/main",
    compare_url: "https://git.example.org/alice/repo/compare/aaa...bbb",
    repository: { full_name: "alice/repo", private: false },
    pusher: { login: "alice" },
    commits: [
        {
            id: "aaa111",
            message: "first commit",
            url: "https://git.example.org/alice/repo/commit/aaa111",
            timestamp: "2026-08-14T10:00:00Z",
            added: ["a.ts"],
            removed: [],
            modified: [],
        },
        {
            id: "bbb222",
            message: "second commit",
            url: "https://git.example.org/alice/repo/commit/bbb222",
            timestamp: "2026-08-14T10:05:00Z",
            added: [],
            removed: [],
            modified: ["a.ts"],
        },
    ],
};

describe("POST /webhook", () => {
    it("enqueues one task per commit and returns 200 for a validly-signed request", async () => {
        const body = JSON.stringify(twoCommitPayload);
        const res = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-Forgejo-Signature": sign(body),
            },
            body,
        });

        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({ ok: true, queued: 2 });

        const tasks = await queue.list();
        expect(tasks).toHaveLength(2);
        const commitIds = tasks.map((t) => t.payload.commitId).sort();
        expect(commitIds).toEqual(["aaa111", "bbb222"]);

        const first = tasks.find((t) => t.payload.commitId === "aaa111");
        expect(first?.payload).toMatchObject({
            repoFullName: "alice/repo",
            repoPrivate: false,
            ref: "refs/heads/main",
            pusherLogin: "alice",
            message: "first commit",
            added: ["a.ts"],
        });
    });

    it("rejects a request with no signature header and enqueues nothing", async () => {
        const body = JSON.stringify(twoCommitPayload);
        const res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body,
        });

        expect(res.status).toBe(401);
        expect(await queue.list()).toEqual([]);
    });

    it("rejects a request with a wrong signature and enqueues nothing", async () => {
        const body = JSON.stringify(twoCommitPayload);
        const res = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-Forgejo-Signature": sign('{"tampered":true}'),
            },
            body,
        });

        expect(res.status).toBe(401);
        expect(await queue.list()).toEqual([]);
    });

    it("queues nothing and still returns 200 for a delivery with zero commits", async () => {
        const payload = { ...twoCommitPayload, commits: [] };
        const body = JSON.stringify(payload);
        const res = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-Forgejo-Signature": sign(body),
            },
            body,
        });

        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({ ok: true, queued: 0 });
        expect(await queue.list()).toEqual([]);
    });

    it("captures repository.private correctly for a private repo", async () => {
        const payload = {
            ...twoCommitPayload,
            repository: { full_name: "alice/secret-repo", private: true },
            commits: [twoCommitPayload.commits[0]],
        };
        const body = JSON.stringify(payload);
        const res = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-Forgejo-Signature": sign(body),
            },
            body,
        });

        expect(res.status).toBe(200);
        const [task] = await queue.list();
        expect(task?.payload.repoPrivate).toBe(true);
        expect(task?.payload.repoFullName).toBe("alice/secret-repo");
    });
});
