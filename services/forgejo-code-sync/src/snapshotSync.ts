import { deriveAcl } from "./evault/acl.js";
import type {
    EVaultClient,
    RepoSnapshotEnvelopePayload,
} from "./evault/client.js";
import type { IdentityResolver } from "./identity.js";
import type { Queue, QueueTaskStatus } from "./queue.js";
import type { RepoEnvelopeStore } from "./repoEnvelopeStore.js";
import type { RepoSnapshotTask } from "./task.js";

/**
 * Fetches a repo archive at the push's headCommitId and uploads it to S3,
 * returning the resulting URL. Throws on any failure - see content/archive.ts.
 */
export type ArchiveFetcher = (task: RepoSnapshotTask) => Promise<string>;

export type SnapshotDrainOutcome =
    | { kind: "succeeded"; envelopeId: string }
    | { kind: "skipped" }
    | { kind: "failed"; status: QueueTaskStatus; error: unknown };

export interface SnapshotDrainDeps {
    queue: Queue<RepoSnapshotTask>;
    identity: IdentityResolver;
    evault: EVaultClient;
    fetchArchive: ArchiveFetcher;
    store: RepoEnvelopeStore;
    /** Injectable for deterministic tests; defaults to the real clock. */
    now?: () => Date;
    onOutcome?: (
        taskId: string,
        task: RepoSnapshotTask,
        outcome: SnapshotDrainOutcome,
    ) => void;
}

/**
 * Processes one queued repo-snapshot task through to completion: resolve the
 * OWNER's eName, derive the ACL, fetch a fresh archive, then create-or-update
 * that repo's one `repoSnapshot` MetaEnvelope - never a second one.
 *
 * Mirrors sync.ts's processTask in shape and failure semantics deliberately -
 * same "skip vs retry vs exhausted" distinctions, same reasoning for why an
 * unresolved eName is a skip, not a failure - but resolves the REPO OWNER
 * (`task.ownerLogin`), not the pusher, and reuses the exact same
 * `IdentityResolver` (it is already generic over any Forgejo username, not
 * pusher-specific) and the exact same `deriveAcl` (the same repo-visibility
 * signal governs both the commit envelope's ACL and this one).
 *
 * An org-owned repo resolves the same way an unlinked personal account does:
 * `GET /api/v1/users/{orgLogin}` succeeds (Forgejo stores organizations as
 * user-table rows too, and that endpoint has no user-type filter - checked
 * against `routers/api/v1/user/user.go`'s `GetInfo`), but an organization
 * never signs in through the bridge, so its `login_name` never starts with
 * "@" and `IdentityResolver.resolveEname` naturally returns `null` for it -
 * no separate "is this an organization" check needed, it falls out of the
 * existing identity resolution for free.
 */
export async function processSnapshotTask(
    taskId: string,
    task: RepoSnapshotTask,
    deps: SnapshotDrainDeps,
): Promise<SnapshotDrainOutcome> {
    const now = deps.now ?? (() => new Date());
    try {
        const eName = await deps.identity.resolveEname(task.ownerLogin);
        if (!eName) {
            await deps.queue.markSkipped(taskId);
            const outcome: SnapshotDrainOutcome = { kind: "skipped" };
            deps.onOutcome?.(taskId, task, outcome);
            return outcome;
        }

        const acl = deriveAcl(task.repoPrivate, eName);
        const snapshotUrl = await deps.fetchArchive(task);
        const existingEnvelopeId = await deps.store.get(task.repoFullName);

        const payload: RepoSnapshotEnvelopePayload = {
            repo: task.repoFullName,
            ref: task.ref,
            headCommitId: task.headCommitId,
            ownerEName: eName,
            snapshotUrl,
            updatedAt: now().toISOString(),
        };

        const envelopeId = await deps.evault.writeRepoSnapshot(
            eName,
            payload,
            acl,
            existingEnvelopeId,
        );
        await deps.store.set(task.repoFullName, envelopeId);

        await deps.queue.markSucceeded(taskId);
        const outcome: SnapshotDrainOutcome = {
            kind: "succeeded",
            envelopeId,
        };
        deps.onOutcome?.(taskId, task, outcome);
        return outcome;
    } catch (error) {
        const status = await deps.queue.markFailed(taskId, error);
        const outcome: SnapshotDrainOutcome = { kind: "failed", status, error };
        deps.onOutcome?.(taskId, task, outcome);
        return outcome;
    }
}

/** Drains every currently-due snapshot task once. Call on an interval from index.ts. */
export async function drainSnapshotsOnce(
    deps: SnapshotDrainDeps,
): Promise<SnapshotDrainOutcome[]> {
    const due = await deps.queue.due();
    const outcomes: SnapshotDrainOutcome[] = [];
    for (const task of due) {
        outcomes.push(await processSnapshotTask(task.id, task.payload, deps));
    }
    return outcomes;
}
