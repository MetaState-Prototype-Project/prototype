import { deriveAcl } from "./evault/acl.js";
import type { CommitEnvelopePayload, EVaultClient } from "./evault/client.js";
import type { IdentityResolver } from "./identity.js";
import type { Queue, QueueTaskStatus } from "./queue.js";
import type { CommitSyncTask } from "./task.js";

/**
 * Fetches a commit's diff and uploads it to S3, returning the resulting URL.
 * Throws on any failure - network, non-2xx, S3 upload - there is no longer a
 * degraded fallback to return instead; see content/diff.ts.
 */
export type DiffFetcher = (
    task: CommitSyncTask,
    eName: string,
) => Promise<string>;

export type DrainOutcome =
    | { kind: "succeeded"; envelopeId: string }
    | { kind: "skipped" }
    | { kind: "failed"; status: QueueTaskStatus; error: unknown };

export interface DrainDeps {
    queue: Queue<CommitSyncTask>;
    identity: IdentityResolver;
    evault: EVaultClient;
    fetchDiff: DiffFetcher;
    /** Called for every outcome, so the caller can log/alert distinctly per kind - see the spec's "Delivery reliability" section. */
    onOutcome?: (
        taskId: string,
        task: CommitSyncTask,
        outcome: DrainOutcome,
    ) => void;
}

/**
 * Processes one queued commit-sync task through to completion: resolve the
 * pusher's eName, derive the ACL, fetch the diff, write the MetaEnvelope.
 *
 * An eName that resolves to `null` (no linked eVault) is a skip, not a failure
 * - it must never enter the retry path, and must be indistinguishable from
 * neither "still pending" nor "exhausted" from the queue's point of view (see
 * queue.ts's `markSkipped`). Any thrown error - a failed identity lookup, an
 * eVault write failure - marks the task failed and lets the queue's own
 * backoff decide whether to retry it.
 */
export async function processTask(
    taskId: string,
    task: CommitSyncTask,
    deps: DrainDeps,
): Promise<DrainOutcome> {
    try {
        const eName = await deps.identity.resolveEname(task.pusherLogin);
        if (!eName) {
            await deps.queue.markSkipped(taskId);
            const outcome: DrainOutcome = { kind: "skipped" };
            deps.onOutcome?.(taskId, task, outcome);
            return outcome;
        }

        const acl = deriveAcl(task.repoPrivate, eName);
        const diffUrl = await deps.fetchDiff(task, eName);

        const payload: CommitEnvelopePayload = {
            id: task.commitId,
            repo: task.repoFullName,
            ref: task.ref,
            message: task.message,
            authorEName: eName,
            committedAt: task.committedAt,
            added: task.added,
            removed: task.removed,
            modified: task.modified,
            diffUrl,
        };

        const envelopeId = await deps.evault.writeCommit(eName, payload, acl);
        await deps.queue.markSucceeded(taskId);
        const outcome: DrainOutcome = { kind: "succeeded", envelopeId };
        deps.onOutcome?.(taskId, task, outcome);
        return outcome;
    } catch (error) {
        const status = await deps.queue.markFailed(taskId, error);
        const outcome: DrainOutcome = { kind: "failed", status, error };
        deps.onOutcome?.(taskId, task, outcome);
        return outcome;
    }
}

/** Drains every currently-due task once. Call on an interval from index.ts. */
export async function drainOnce(deps: DrainDeps): Promise<DrainOutcome[]> {
    const due = await deps.queue.due();
    const outcomes: DrainOutcome[] = [];
    for (const task of due) {
        outcomes.push(await processTask(task.id, task.payload, deps));
    }
    return outcomes;
}
