import express, { type Express } from "express";
import type { Queue } from "./queue.js";
import type { CommitSyncTask, RepoSnapshotTask } from "./task.js";
import { createPushHandlers } from "./webhook/push.js";

export interface AppDeps {
    queue: Queue<CommitSyncTask>;
    snapshotQueue: Queue<RepoSnapshotTask>;
    webhookSecret: string;
}

export function createApp(deps: AppDeps): Express {
    const app = express();

    // Behind TLS termination in staging and production, same as the bridge.
    app.set("trust proxy", true);
    app.disable("x-powered-by");

    app.get("/healthz", (_req, res) => {
        res.json({ ok: true });
    });

    // Route-scoped raw-body parsing lives in createPushHandlers itself - see
    // webhook/push.ts for why a global express.json() would be the wrong tool
    // here.
    app.post(
        "/webhook",
        ...createPushHandlers({
            commitQueue: deps.queue,
            snapshotQueue: deps.snapshotQueue,
            webhookSecret: deps.webhookSecret,
        }),
    );

    return app;
}
