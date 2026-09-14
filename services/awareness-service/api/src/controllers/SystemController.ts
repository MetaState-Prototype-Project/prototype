import { Router } from "express";
import { AppDataSource } from "../database/data-source";
import { WorkerHeartbeat } from "../database/entities/WorkerHeartbeat";
import { config } from "../config";

interface QueueStats {
    pending: string;
    failed: string;
    delivering: string;
    dead: string;
    expired_leases: string;
    oldest_pending_seconds: string | null;
}

export async function queueStats(): Promise<QueueStats> {
    const rows = await AppDataSource.query(`
        SELECT
            count(*) FILTER (WHERE status = 'pending')::text AS pending,
            count(*) FILTER (WHERE status = 'failed')::text AS failed,
            count(*) FILTER (WHERE status = 'delivering')::text AS delivering,
            count(*) FILTER (WHERE status = 'dead')::text AS dead,
            count(*) FILTER (
                WHERE status = 'delivering' AND "leaseExpiresAt" <= now()
            )::text AS expired_leases,
            extract(epoch FROM now() - (
                min("createdAt") FILTER (
                    WHERE status IN ('pending', 'failed', 'delivering')
                )
            ))::text AS oldest_pending_seconds
        FROM deliveries
    `);
    return rows[0];
}

export function systemRouter(): Router {
    const router = Router();

    router.get("/health", (_req, res) => {
        res.json({ status: "ok", service: "awareness-service" });
    });

    router.get("/ready", async (_req, res) => {
        try {
            await AppDataSource.query("SELECT 1");
            const migrationsPending = await AppDataSource.showMigrations();
            const heartbeat = await AppDataSource.getRepository(WorkerHeartbeat)
                .createQueryBuilder("h")
                .orderBy("h.heartbeatAt", "DESC")
                .getOne();
            const workerAgeMs = heartbeat
                ? Date.now() - heartbeat.heartbeatAt.getTime()
                : null;
            const workerReady =
                workerAgeMs !== null && workerAgeMs <= config.workerStaleMs;
            const stats = await queueStats();
            const ready = workerReady && !migrationsPending;
            return res.status(ready ? 200 : 503).json({
                status: ready ? "ready" : "not-ready",
                database: "ok",
                migrations: migrationsPending ? "pending" : "current",
                worker: workerReady ? "ok" : "stale",
                workerAgeMs,
                queue: stats,
            });
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
            const heartbeatAge = heartbeat
                ? Math.max(0, (Date.now() - heartbeat.heartbeatAt.getTime()) / 1000)
                : -1;
            const lines = [
                "# HELP aaas_deliveries Delivery rows by queue state.",
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
                "# HELP aaas_worker_heartbeat_age_seconds Age of the newest worker heartbeat; -1 means absent.",
                "# TYPE aaas_worker_heartbeat_age_seconds gauge",
                `aaas_worker_heartbeat_age_seconds ${heartbeatAge}`,
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
