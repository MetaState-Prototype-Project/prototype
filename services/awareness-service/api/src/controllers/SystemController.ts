import { Router } from "express";
import { AppDataSource } from "../database/data-source";
import { WorkerHeartbeat } from "../database/entities/WorkerHeartbeat";
import { config } from "../config";
import type { WorkerStatus } from "../services/DeliveryEngine";

/** Queue counts are bounded so health probes never scan a large backlog. */
export const QUEUE_COUNT_CAP = 10_000;

interface QueueStats {
    pending: string;
    failed: string;
    delivering: string;
    /** Unresolved dead letters. */
    dead: string;
    expired_leases: string;
    oldest_pending_seconds: string | null;
    /** How long the most overdue pending/failed delivery has been claimable. */
    oldest_due_seconds: string;
}

/**
 * Queue health from partial indexes only. `deliveries` keeps every delivered
 * and dead row, so anything that aggregates the whole table times out in
 * production; counts are capped at QUEUE_COUNT_CAP and every probe runs under
 * its own short statement timeout.
 */
export async function queueStats(): Promise<QueueStats> {
    const capped = (from: string, where: string) =>
        `(SELECT count(*) FROM (SELECT 1 FROM ${from} WHERE ${where} LIMIT ${QUEUE_COUNT_CAP}) capped)::text`;
    return AppDataSource.transaction(async (manager) => {
        await manager.query(
            `SET LOCAL statement_timeout = ${Number(config.healthQueryTimeoutMs)}`,
        );
        const rows = await manager.query(`
            SELECT
                ${capped("deliveries", "status = 'pending'")} AS pending,
                ${capped("deliveries", "status = 'failed'")} AS failed,
                ${capped("deliveries", "status = 'delivering'")} AS delivering,
                ${capped("dead_letters", "resolved = false")} AS dead,
                ${capped("deliveries", `status = 'delivering' AND "leaseExpiresAt" <= now()`)} AS expired_leases,
                extract(epoch FROM now() - (
                    SELECT min("createdAt") FROM deliveries
                    WHERE status IN ('pending', 'failed', 'delivering')
                ))::text AS oldest_pending_seconds,
                greatest(0, coalesce(extract(epoch FROM now() - (
                    SELECT min("nextAttemptAt") FROM deliveries
                    WHERE status IN ('pending', 'failed')
                )), 0))::text AS oldest_due_seconds
        `);
        return rows[0];
    });
}

type WorkerState = "ok" | "stale" | "failing";

/** Progress, not mere liveness: a loop whose every claim fails is "failing". */
function progressState(
    lastSuccessAt: Date | null,
    consecutiveFailures: number,
    since: Date | null,
    now: number,
): Exclude<WorkerState, "stale"> {
    if (consecutiveFailures >= config.workerMaxConsecutiveFailures) {
        return "failing";
    }
    const reference = lastSuccessAt ?? since;
    return reference &&
        now - reference.getTime() <= config.workerProgressStaleMs
        ? "ok"
        : "failing";
}

/** In-process worker health for /health; never touches the database. */
export function workerHealth(status: WorkerStatus, now = Date.now()) {
    // A just-started worker is given one progress window before judgement.
    const state = status.startedAt
        ? progressState(
              status.lastSuccessAt,
              status.consecutiveFailures,
              status.startedAt,
              now,
          )
        : "failing";
    return {
        state,
        lastSuccessAgeMs: status.lastSuccessAt
            ? now - status.lastSuccessAt.getTime()
            : null,
        consecutiveFailures: status.consecutiveFailures,
        lastError: status.lastError,
    };
}

export async function readiness(): Promise<{ ready: boolean; body: object }> {
    await AppDataSource.query("SELECT 1");
    const migrationsPending = await AppDataSource.showMigrations();
    const now = Date.now();
    const heartbeats = await AppDataSource.getRepository(WorkerHeartbeat)
        .createQueryBuilder("h")
        .where("h.heartbeatAt >= :fresh", {
            fresh: new Date(now - config.workerStaleMs),
        })
        .getMany();
    const states = heartbeats.map((heartbeat) => ({
        heartbeat,
        state: progressState(
            heartbeat.lastSuccessAt,
            heartbeat.consecutiveFailures,
            null,
            now,
        ),
    }));
    const best =
        states.find((entry) => entry.state === "ok") ?? states[0] ?? null;
    const worker: WorkerState = best ? best.state : "stale";
    const stats = await queueStats();
    const ready = worker === "ok" && !migrationsPending;
    return {
        ready,
        body: {
            status: ready ? "ready" : "not-ready",
            database: "ok",
            migrations: migrationsPending ? "pending" : "current",
            worker,
            workerAgeMs: best ? now - best.heartbeat.heartbeatAt.getTime() : null,
            lastSuccessAgeMs: best?.heartbeat.lastSuccessAt
                ? now - best.heartbeat.lastSuccessAt.getTime()
                : null,
            consecutiveFailures: best?.heartbeat.consecutiveFailures ?? null,
            lastError: best?.heartbeat.lastError ?? null,
            queue: stats,
        },
    };
}

export function systemRouter(worker?: { status(): WorkerStatus }): Router {
    const router = Router();

    router.get("/health", (_req, res) => {
        if (!worker) {
            return res.json({ status: "ok", service: "awareness-service" });
        }
        const delivery = workerHealth(worker.status());
        const ok = delivery.state === "ok";
        return res.status(ok ? 200 : 503).json({
            status: ok ? "ok" : "degraded",
            service: "awareness-service",
            delivery,
        });
    });

    router.get("/ready", async (_req, res) => {
        try {
            const { ready, body } = await readiness();
            return res.status(ready ? 200 : 503).json(body);
        } catch (error) {
            return res.status(503).json({
                status: "not-ready",
                database: "unavailable",
                error: error instanceof Error ? error.message : String(error),
            });
        }
    });

    router.get("/metrics", async (_req, res) => {
        try {
            const stats = await queueStats();
            const heartbeat = await AppDataSource.getRepository(WorkerHeartbeat)
                .createQueryBuilder("h")
                .orderBy("h.heartbeatAt", "DESC")
                .getOne();
            const now = Date.now();
            const heartbeatAge = heartbeat
                ? Math.max(0, (now - heartbeat.heartbeatAt.getTime()) / 1000)
                : -1;
            const successAge = heartbeat?.lastSuccessAt
                ? Math.max(0, (now - heartbeat.lastSuccessAt.getTime()) / 1000)
                : -1;
            const lines = [
                `# HELP aaas_deliveries Delivery rows by queue state (capped at ${QUEUE_COUNT_CAP}; dead = unresolved dead letters).`,
                "# TYPE aaas_deliveries gauge",
                `aaas_deliveries{status="pending"} ${stats.pending}`,
                `aaas_deliveries{status="failed"} ${stats.failed}`,
                `aaas_deliveries{status="delivering"} ${stats.delivering}`,
                `aaas_deliveries{status="dead"} ${stats.dead}`,
                "# HELP aaas_expired_leases Deliveries whose worker lease expired.",
                "# TYPE aaas_expired_leases gauge",
                `aaas_expired_leases ${stats.expired_leases}`,
                "# HELP aaas_oldest_pending_seconds Age of the oldest active delivery.",
                "# TYPE aaas_oldest_pending_seconds gauge",
                `aaas_oldest_pending_seconds ${stats.oldest_pending_seconds ?? 0}`,
                "# HELP aaas_oldest_due_seconds How long the most overdue delivery has waited to be claimed.",
                "# TYPE aaas_oldest_due_seconds gauge",
                `aaas_oldest_due_seconds ${stats.oldest_due_seconds}`,
                "# HELP aaas_worker_heartbeat_age_seconds Age of the newest worker heartbeat; -1 means absent.",
                "# TYPE aaas_worker_heartbeat_age_seconds gauge",
                `aaas_worker_heartbeat_age_seconds ${heartbeatAge}`,
                "# HELP aaas_worker_last_success_age_seconds Age of the newest worker's last successful tick; -1 means never.",
                "# TYPE aaas_worker_last_success_age_seconds gauge",
                `aaas_worker_last_success_age_seconds ${successAge}`,
                "# HELP aaas_worker_consecutive_failures Failed ticks since the newest worker's last success.",
                "# TYPE aaas_worker_consecutive_failures gauge",
                `aaas_worker_consecutive_failures ${heartbeat?.consecutiveFailures ?? 0}`,
                "",
            ];
            res.type("text/plain; version=0.0.4").send(lines.join("\n"));
        } catch (error) {
            res.status(503).type("text/plain").send(
                `# metrics unavailable: ${error instanceof Error ? error.message : String(error)}\n`,
            );
        }
    });

    return router;
}
