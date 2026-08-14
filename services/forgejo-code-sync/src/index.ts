import path from "node:path";
import { fileURLToPath } from "node:url";
import { createApp } from "./app.js";
import { ConfigError, getConfig } from "./config.js";
import { createArchiveFetcher } from "./content/archive.js";
import { createDiffFetcher } from "./content/diff.js";
import { EVaultClient } from "./evault/client.js";
import { IdentityResolver } from "./identity.js";
import { Queue } from "./queue.js";
import { RepoEnvelopeStore } from "./repoEnvelopeStore.js";
import {
    type SnapshotDrainOutcome,
    drainSnapshotsOnce,
} from "./snapshotSync.js";
import { S3Storage } from "./storage/s3.js";
import { type DrainOutcome, drainOnce } from "./sync.js";
import type { CommitSyncTask, RepoSnapshotTask } from "./task.js";

/**
 * How often the queues are drained. A task's own backoff (queue.ts) governs when
 * an individual retry is due; this just bounds how long a freshly-queued or
 * newly-due task waits before the next sweep picks it up.
 */
const DRAIN_INTERVAL_MS = 5_000;

function logOutcome(
    taskId: string,
    task: CommitSyncTask,
    outcome: DrainOutcome,
): void {
    const label = `${task.repoFullName}@${task.commitId.slice(0, 12)}`;
    switch (outcome.kind) {
        case "succeeded":
            console.log(`[sync] ${label} -> envelope ${outcome.envelopeId}`);
            break;
        case "skipped":
            // The ordinary case for most GitW3 accounts, not a failure - see
            // the spec's "Identity resolution" section. Must read distinctly
            // from a "failed" log line, never look the same.
            console.log(
                `[sync] ${label} skipped - no linked eVault for pusher "${task.pusherLogin}"`,
            );
            break;
        case "failed":
            if (outcome.status === "exhausted") {
                // Needs a human. This is the one outcome that must not be
                // mistaken for a routine skip or a retry still in flight.
                console.error(
                    `[sync] EXHAUSTED task ${taskId} (${label}), needs attention: ${String(outcome.error)}`,
                );
            } else {
                console.warn(
                    `[sync] ${label} failed, retrying: ${String(outcome.error)}`,
                );
            }
            break;
    }
}

/**
 * Same shape as logOutcome above, deliberately - the owner-snapshot sync's
 * skip/retry/exhausted outcomes must read exactly as distinctly as the
 * per-commit sync's do, per the same "never look the same as an error"
 * requirement the spec's Delivery reliability section states for the
 * commit path.
 */
function logSnapshotOutcome(
    taskId: string,
    task: RepoSnapshotTask,
    outcome: SnapshotDrainOutcome,
): void {
    const label = `${task.repoFullName}@${task.headCommitId.slice(0, 12)}`;
    switch (outcome.kind) {
        case "succeeded":
            console.log(
                `[snapshot] ${label} -> envelope ${outcome.envelopeId}`,
            );
            break;
        case "skipped":
            // Covers both an ordinary unlinked owner and an org-owned repo -
            // see snapshotSync.ts's processSnapshotTask for why both fall out
            // of the same identity resolution with no separate check.
            console.log(
                `[snapshot] ${label} skipped - no linked eVault for owner "${task.ownerLogin}"`,
            );
            break;
        case "failed":
            if (outcome.status === "exhausted") {
                console.error(
                    `[snapshot] EXHAUSTED task ${taskId} (${label}), needs attention: ${String(outcome.error)}`,
                );
            } else {
                console.warn(
                    `[snapshot] ${label} failed, retrying: ${String(outcome.error)}`,
                );
            }
            break;
    }
}

async function main(): Promise<void> {
    // Anything wrong with the environment stops the process here, rather than
    // surfacing as a silently-unresolved eName on the first push, when the
    // symptom no longer points at the cause - matching the bridge's own
    // config.ts.
    const config = getConfig();

    const here = path.dirname(fileURLToPath(import.meta.url));
    // Where the retry queue persists in a real deployment is an open item tied
    // to that deployment's own storage - see the plan's Phase 5. This default
    // is for local development, next to the package rather than inside src/
    // or dist/ so it survives a rebuild.
    const queueDir = path.resolve(here, "../.queue");
    // A second, independent queue - see task.ts's RepoSnapshotTask and
    // webhook/push.ts for why this can't share the commit queue's contents
    // (different task shape, different granularity - one per push, not one
    // per commit).
    const snapshotQueueDir = path.resolve(here, "../.queue-snapshots");
    // repoFullName -> envelopeId, so a later push updates the same
    // repoSnapshot envelope in place instead of creating a new one - see
    // repoEnvelopeStore.ts.
    const repoEnvelopeStoreDir = path.resolve(here, "../.repo-envelopes");

    const queue = new Queue<CommitSyncTask>({ dir: queueDir });
    await queue.init();

    const snapshotQueue = new Queue<RepoSnapshotTask>({
        dir: snapshotQueueDir,
    });
    await snapshotQueue.init();

    const repoEnvelopeStore = new RepoEnvelopeStore({
        dir: repoEnvelopeStoreDir,
    });
    await repoEnvelopeStore.init();

    const identity = new IdentityResolver({
        forgejoApiUrl: config.forgejoApiUrl,
        adminToken: config.forgejoAdminToken,
    });

    const evault = new EVaultClient({
        registryUrl: config.registryUrl,
        evaultServerUri: config.evaultServerUri,
        publicUrl: config.publicUrl,
    });

    const storage = new S3Storage(config.s3);

    const fetchDiff = createDiffFetcher({
        forgejoApiUrl: config.forgejoApiUrl,
        adminToken: config.forgejoAdminToken,
        storage,
    });

    const fetchArchive = createArchiveFetcher({
        forgejoApiUrl: config.forgejoApiUrl,
        adminToken: config.forgejoAdminToken,
        storage,
    });

    const app = createApp({
        queue,
        snapshotQueue,
        webhookSecret: config.webhookSecret,
    });

    const server = app.listen(config.port, () => {
        console.log(`forgejo-code-sync listening on :${config.port}`);
        console.log(`  forgejo  ${config.forgejoApiUrl}`);
        console.log(`  registry ${config.registryUrl}`);
        console.log(`  evault   ${config.evaultServerUri}`);
        console.log(`  s3       ${config.s3.bucket} (${config.s3.endpoint})`);
        console.log(`  queue    ${queueDir}`);
        console.log(`  queue    ${snapshotQueueDir} (repo snapshots)`);
    });

    // Guards against overlapping drains: if a sweep is still running (e.g. a
    // slow eVault) when the next tick fires, that tick is skipped rather than
    // starting a second pass over the same due tasks - two concurrent drains
    // could otherwise both pick up the same task before either marks it done.
    // Both queues share one guard and one interval: they're independent
    // stores, but there's no reason to run two separate timers for what's
    // conceptually one "drain everything that's due" tick.
    let draining = false;
    const timer = setInterval(() => {
        if (draining) return;
        draining = true;
        Promise.all([
            drainOnce({
                queue,
                identity,
                evault,
                fetchDiff,
                onOutcome: logOutcome,
            }),
            drainSnapshotsOnce({
                queue: snapshotQueue,
                identity,
                evault,
                fetchArchive,
                store: repoEnvelopeStore,
                onOutcome: logSnapshotOutcome,
            }),
        ])
            .catch((error: unknown) => {
                console.error("[sync] drain failed:", error);
            })
            .finally(() => {
                draining = false;
            });
    }, DRAIN_INTERVAL_MS);
    timer.unref();

    const shutdown = () => {
        clearInterval(timer);
        server.close(() => process.exit(0));
    };
    process.on("SIGTERM", shutdown);
    process.on("SIGINT", shutdown);
}

main().catch((error: unknown) => {
    if (error instanceof ConfigError) {
        console.error(`forgejo-code-sync cannot start: ${error.message}`);
        process.exit(1);
    }
    console.error(error);
    process.exit(1);
});
