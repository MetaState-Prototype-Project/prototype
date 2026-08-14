import express, { type RequestHandler } from "express";
import type { Queue } from "../queue.js";
import type { CommitSyncTask, RepoSnapshotTask } from "../task.js";
import type { ForgejoPushPayload } from "./pushPayload.js";
import { verifyForgejoSignature } from "./signature.js";

/** Git's all-zero sha, sent as `after` on a branch/tag deletion push - nothing to snapshot. */
const ALL_ZERO_SHA = /^0+$/;

export interface PushHandlerDeps {
    commitQueue: Queue<CommitSyncTask>;
    /** A second, independent persisted queue - see queue.ts's own generality and index.ts's wiring. */
    snapshotQueue: Queue<RepoSnapshotTask>;
    webhookSecret: string;
}

/**
 * `POST /webhook` - Forgejo's push event.
 *
 * Route-scoped `express.raw()` rather than a global JSON body parser: the
 * signature must be checked against the exact bytes Forgejo sent on the wire
 * (`services/webhook/shared/payloader.go`'s `AddDefaultHeaders` signs the raw
 * body), and a global `express.json()` would hand this handler an
 * already-parsed, already-reserialized object with no guarantee its
 * `JSON.stringify` output matches the original bytes. Parsing manually, after
 * verifying, sidesteps that entirely rather than relying on a `verify` callback
 * elsewhere in the app to capture the raw buffer correctly.
 *
 * Responds once every commit in the delivery is durably queued, not once
 * they're processed - see the spec's "Delivery reliability" section. This
 * response is deliberately decoupled from whether the eventual eVault write
 * succeeds; that happens later, in the queue's drain loop.
 *
 * Two independent things get queued per delivery, deliberately at different
 * granularity: one CommitSyncTask per commit (the per-pusher commit+diff
 * sync, unchanged), and at most ONE RepoSnapshotTask for the whole delivery
 * (the per-owner full-repo sync) - a 10-commit push must not upload the whole
 * repo ten times. The snapshot task is built outside the commit loop, using
 * the push's own `after` (the sha the ref points at once this push lands),
 * not any individual commit's id.
 */
export function createPushHandlers(deps: PushHandlerDeps): RequestHandler[] {
    const captureRawBody = express.raw({
        type: "application/json",
        limit: "10mb",
    });

    const handler: RequestHandler = async (req, res) => {
        const rawBody = req.body as Buffer;
        const signature = req.header("X-Forgejo-Signature");

        if (
            !Buffer.isBuffer(rawBody) ||
            !verifyForgejoSignature(rawBody, deps.webhookSecret, signature)
        ) {
            res.status(401).json({ error: "invalid signature" });
            return;
        }

        let payload: ForgejoPushPayload;
        try {
            payload = JSON.parse(
                rawBody.toString("utf8"),
            ) as ForgejoPushPayload;
        } catch {
            res.status(400).json({ error: "invalid JSON body" });
            return;
        }

        const commits = payload.commits ?? [];
        for (const commit of commits) {
            const task: CommitSyncTask = {
                commitId: commit.id,
                repoFullName: payload.repository.full_name,
                repoPrivate: payload.repository.private,
                ref: payload.ref,
                pusherLogin: payload.pusher.login,
                message: commit.message,
                committedAt: commit.timestamp,
                added: commit.added,
                removed: commit.removed,
                modified: commit.modified,
                commitUrl: commit.url,
                compareUrl: payload.compare_url,
            };
            await deps.commitQueue.enqueue(task);
        }

        // A branch/tag deletion sends `after` as the all-zero sha - there is
        // no ref state left to archive, so no snapshot task is queued for it.
        // `payload.after` also being falsy covers older/malformed payloads
        // missing the field entirely, the same defensive posture as every
        // other field read from this untrusted body.
        let snapshotQueued = false;
        if (payload.after && !ALL_ZERO_SHA.test(payload.after)) {
            const snapshotTask: RepoSnapshotTask = {
                repoFullName: payload.repository.full_name,
                repoPrivate: payload.repository.private,
                ref: payload.ref,
                ownerLogin: payload.repository.owner.login,
                headCommitId: payload.after,
            };
            await deps.snapshotQueue.enqueue(snapshotTask);
            snapshotQueued = true;
        }

        res.status(200).json({
            ok: true,
            queued: commits.length,
            snapshotQueued,
        });
    };

    return [captureRawBody, handler];
}
