import express, { type RequestHandler } from "express";
import type { Queue } from "../queue.js";
import type { CommitSyncTask } from "../task.js";
import type { ForgejoPushPayload } from "./pushPayload.js";
import { verifyForgejoSignature } from "./signature.js";

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
 */
export function createPushHandlers(
    queue: Queue<CommitSyncTask>,
    webhookSecret: string,
): RequestHandler[] {
    const captureRawBody = express.raw({
        type: "application/json",
        limit: "10mb",
    });

    const handler: RequestHandler = async (req, res) => {
        const rawBody = req.body as Buffer;
        const signature = req.header("X-Forgejo-Signature");

        if (
            !Buffer.isBuffer(rawBody) ||
            !verifyForgejoSignature(rawBody, webhookSecret, signature)
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
            await queue.enqueue(task);
        }

        res.status(200).json({ ok: true, queued: commits.length });
    };

    return [captureRawBody, handler];
}
