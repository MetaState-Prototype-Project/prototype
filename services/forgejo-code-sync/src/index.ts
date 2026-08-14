import path from "node:path";
import { fileURLToPath } from "node:url";
import { createApp } from "./app.js";
import { ConfigError, getConfig } from "./config.js";
import { createDiffFetcher } from "./content/diff.js";
import { EVaultClient } from "./evault/client.js";
import { IdentityResolver } from "./identity.js";
import { Queue } from "./queue.js";
import { type DrainOutcome, drainOnce } from "./sync.js";
import type { CommitSyncTask } from "./task.js";

/**
 * How often the queue is drained. A task's own backoff (queue.ts) governs when
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

    const queue = new Queue<CommitSyncTask>({ dir: queueDir });
    await queue.init();

    const identity = new IdentityResolver({
        forgejoApiUrl: config.forgejoApiUrl,
        adminToken: config.forgejoAdminToken,
    });

    const evault = new EVaultClient({
        registryUrl: config.registryUrl,
        evaultServerUri: config.evaultServerUri,
        publicUrl: config.publicUrl,
    });

    const fetchDiff = createDiffFetcher({
        forgejoApiUrl: config.forgejoApiUrl,
        adminToken: config.forgejoAdminToken,
        maxBytes: config.diffMaxBytes,
    });

    const app = createApp({ queue, webhookSecret: config.webhookSecret });

    const server = app.listen(config.port, () => {
        console.log(`forgejo-code-sync listening on :${config.port}`);
        console.log(`  forgejo  ${config.forgejoApiUrl}`);
        console.log(`  registry ${config.registryUrl}`);
        console.log(`  evault   ${config.evaultServerUri}`);
        console.log(`  queue    ${queueDir}`);
    });

    // Guards against overlapping drains: if a sweep is still running (e.g. a
    // slow eVault) when the next tick fires, that tick is skipped rather than
    // starting a second pass over the same due tasks - two concurrent drains
    // could otherwise both pick up the same task before either marks it done.
    let draining = false;
    const timer = setInterval(() => {
        if (draining) return;
        draining = true;
        drainOnce({ queue, identity, evault, fetchDiff, onOutcome: logOutcome })
            .catch((error: unknown) => {
                console.error("[sync] drainOnce failed:", error);
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
