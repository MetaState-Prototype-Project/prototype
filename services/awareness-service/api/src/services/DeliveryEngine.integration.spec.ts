import { PostgreSqlContainer } from "@testcontainers/postgresql";
import axios from "axios";
import {
    afterAll,
    afterEach,
    beforeAll,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from "vitest";
import type { StartedPostgreSqlContainer } from "@testcontainers/postgresql";

const HOUR = 60 * 60 * 1000;

interface Seed {
    packetId: string;
    status?: string;
    createdAt?: Date;
    nextAttemptAt?: Date;
    retryStartedAt?: Date;
    firstAttemptAt?: Date | null;
    leaseToken?: string | null;
    leaseExpiresAt?: Date | null;
}

describe("DeliveryEngine against PostgreSQL", () => {
    let container: StartedPostgreSqlContainer;
    let dataSource: any;
    let config: any;
    let DeliveryEngine: any;
    let buildClaimQuery: any;
    let BATCH_SIZE: number;
    let queueStats: () => Promise<any>;
    let readiness: () => Promise<{ ready: boolean; body: any }>;
    let workerHealth: (status: any) => any;
    let subscription: any;
    let seq = 0;

    beforeAll(async () => {
        container = await new PostgreSqlContainer("postgres:16-alpine").start();
        process.env.AWARENESS_DATABASE_URL = container.getConnectionUri();
        process.env.PUBLIC_REGISTRY_URL = "";
        ({ AppDataSource: dataSource } = await import(
            "../database/data-source"
        ));
        ({ config } = await import("../config"));
        ({ DeliveryEngine, buildClaimQuery, BATCH_SIZE } = await import(
            "./DeliveryEngine"
        ));
        ({ queueStats, readiness, workerHealth } = await import(
            "../controllers/SystemController"
        ));
        const { Consumer } = await import("../database/entities/Consumer");
        const { Subscription } = await import(
            "../database/entities/Subscription"
        );
        await dataSource.initialize();
        await dataSource.runMigrations();

        const consumer = await dataSource.getRepository(Consumer).save({
            ename: "catchall:engine.example",
            name: "engine",
            status: "approved",
            webhookBaseUrl: "https://engine.example",
            approvedAt: new Date(),
        });
        subscription = await dataSource.getRepository(Subscription).save({
            consumerId: consumer.id,
            targetUrl: "https://engine.example/api/webhook",
            ontologyFilter: [],
            evaultFilter: [],
            isCatchAll: true,
            active: true,
            secret: null,
        });
    }, 180_000);

    afterAll(async () => {
        if (dataSource?.isInitialized) await dataSource.destroy();
        if (container) await container.stop();
    });

    beforeEach(async () => {
        await dataSource.query(
            `TRUNCATE deliveries, dead_letters, worker_heartbeats`,
        );
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    async function seed(rows: Seed[]): Promise<any[]> {
        const now = Date.now();
        const values = rows.map((row) => {
            seq += 1;
            return {
                subscriptionId: subscription.id,
                packetId: row.packetId,
                eventId: `event-${seq}`,
                contentHash: "hash",
                payload: { seq },
                status: row.status ?? "pending",
                nextAttemptAt: row.nextAttemptAt ?? new Date(now - 1_000),
                createdAt: row.createdAt ?? new Date(now - 60_000),
                retryStartedAt:
                    row.retryStartedAt ?? row.createdAt ?? new Date(now - 60_000),
                firstAttemptAt: row.firstAttemptAt ?? null,
                leaseToken: row.leaseToken ?? null,
                leaseOwner: row.leaseToken ? "dead-worker" : null,
                leaseExpiresAt: row.leaseExpiresAt ?? null,
            };
        });
        const saved = [];
        for (let i = 0; i < values.length; i += 500) {
            const result = await dataSource
                .createQueryBuilder()
                .insert()
                .into("deliveries")
                .values(values.slice(i, i + 500))
                .returning("*")
                .execute();
            saved.push(...result.raw);
        }
        return saved;
    }

    /** Orders a stream exactly as the claim's predecessor check does. */
    function streamOrder(left: any, right: any): number {
        const byTime =
            new Date(left.createdAt).getTime() -
            new Date(right.createdAt).getTime();
        if (byTime !== 0) return byTime;
        return left.id < right.id ? -1 : left.id > right.id ? 1 : 0;
    }

    async function complete(claimed: any[]): Promise<void> {
        for (const delivery of claimed) {
            const update = await dataSource.query(
                `UPDATE deliveries SET status = 'delivered', "leaseToken" = NULL,
                 "leaseOwner" = NULL, "leaseExpiresAt" = NULL
                 WHERE id = $1 AND "leaseToken" = $2`,
                [delivery.id, delivery.leaseToken],
            );
            expect(update[1]).toBe(1);
        }
    }

    it("never hands the same delivery or two events of one stream to concurrent workers", async () => {
        const base = Date.now() - HOUR;
        const rows: Seed[] = [];
        for (let stream = 0; stream < 300; stream += 1) {
            for (let event = 0; event < 3; event += 1) {
                rows.push({
                    packetId: `concurrent-${stream}`,
                    createdAt: new Date(base + stream * 10 + event),
                });
            }
        }
        const seeded = await seed(rows);
        const heads = new Set(
            Object.values(
                seeded.reduce((acc: Record<string, any>, row: any) => {
                    const head = acc[row.packetId];
                    if (!head || streamOrder(row, head) < 0) {
                        acc[row.packetId] = row;
                    }
                    return acc;
                }, {}),
            ).map((row: any) => row.id),
        );

        const engines = Array.from({ length: 6 }, () => new DeliveryEngine());
        const batches: any[][] = await Promise.all(
            engines.map((engine: any) => engine.claimBatch()),
        );

        const ids = batches.flat().map((delivery) => delivery.id);
        expect(new Set(ids).size).toBe(ids.length);
        for (const batch of batches) {
            expect(batch.length).toBeLessThanOrEqual(BATCH_SIZE);
            expect(new Set(batch.map((d) => d.leaseToken)).size).toBe(1);
        }
        expect(ids.length).toBeGreaterThan(BATCH_SIZE);
        for (const id of ids) expect(heads.has(id)).toBe(true);

        const [{ max }] = await dataSource.query(
            `SELECT max(n)::int AS max FROM (
                SELECT count(*) AS n FROM deliveries
                WHERE status = 'delivering' GROUP BY "subscriptionId", "packetId"
            ) s`,
        );
        expect(max).toBe(1);
    });

    it("drains every stream in createdAt/id order, including equal timestamps", async () => {
        const base = Date.now() - HOUR;
        const rows: Seed[] = [];
        for (let stream = 0; stream < 20; stream += 1) {
            for (let event = 0; event < 5; event += 1) {
                rows.push({
                    packetId: `order-${stream}`,
                    // Pairs of events share a timestamp; id breaks the tie.
                    createdAt: new Date(base + Math.floor(event / 2)),
                    // Later events are due earlier, so nextAttemptAt order
                    // alone would deliver them out of order.
                    nextAttemptAt: new Date(base - event * 1_000),
                });
            }
        }
        const seeded = await seed(rows);
        const expected: Record<string, string[]> = {};
        for (const row of [...seeded].sort(streamOrder)) {
            (expected[row.packetId] ??= []).push(row.id);
        }

        const engine = new DeliveryEngine() as any;
        const delivered: Record<string, string[]> = {};
        for (let round = 0; round < 10; round += 1) {
            const claimed = await engine.claimBatch();
            if (claimed.length === 0) break;
            for (const delivery of claimed) {
                (delivered[delivery.packetId] ??= []).push(delivery.id);
            }
            await complete(claimed);
        }
        expect(delivered).toEqual(expected);
    });

    it("recovers an expired lease and rejects every completion by the stale worker", async () => {
        const staleToken = "00000000-0000-4000-8000-00000000dead";
        const [head, successor] = await seed([
            {
                packetId: "lease",
                status: "delivering",
                createdAt: new Date(Date.now() - 2 * HOUR),
                firstAttemptAt: new Date(Date.now() - 30 * HOUR),
                leaseToken: staleToken,
                leaseExpiresAt: new Date(Date.now() - 1_000),
            },
            { packetId: "lease", createdAt: new Date(Date.now() - HOUR) },
        ]);

        const engine = new DeliveryEngine() as any;
        const claimed = await engine.claimBatch();
        expect(claimed.map((d: any) => d.id)).toEqual([head.id]);
        const freshToken = claimed[0].leaseToken;
        expect(freshToken).not.toBe(staleToken);
        expect(new Date(claimed[0].leaseExpiresAt).getTime()).toBeGreaterThan(
            Date.now(),
        );

        // The stale worker finishes late: success, failure (past its retry
        // window, i.e. the dead-letter path) and unexpected-error paths.
        const stale = { ...head, leaseToken: staleToken };
        vi.spyOn(axios, "post").mockResolvedValue({ status: 200 } as any);
        await engine.attemptDelivery(stale);
        await engine.fail(stale, subscription, "late failure", 500, {});
        await engine.rescheduleUnexpected(stale, "late crash");

        const [row] = await dataSource.query(
            `SELECT status, "leaseToken", attempts FROM deliveries WHERE id = $1`,
            [head.id],
        );
        expect(row).toEqual({
            status: "delivering",
            leaseToken: freshToken,
            attempts: 0,
        });
        expect(
            Number(
                (await dataSource.query(`SELECT count(*) FROM dead_letters`))[0]
                    .count,
            ),
        ).toBe(0);
        // The successor stays blocked behind the recovered head.
        expect(await engine.claimBatch()).toEqual([]);

        await engine.attemptDelivery(claimed[0]);
        const next = await engine.claimBatch();
        expect(next.map((d: any) => d.id)).toEqual([successor.id]);
    });

    describe("fair sharing of the 50-row batch", () => {
        async function seedLanes(due: number, expired: number) {
            const rows: Seed[] = [];
            for (let i = 0; i < due; i += 1) {
                rows.push({ packetId: `due-${i}` });
            }
            for (let i = 0; i < expired; i += 1) {
                rows.push({
                    packetId: `expired-${i}`,
                    status: "delivering",
                    leaseToken: "00000000-0000-4000-8000-000000000001",
                    leaseExpiresAt: new Date(Date.now() - 1_000),
                });
            }
            await seed(rows);
            const claimed = await (new DeliveryEngine() as any).claimBatch();
            return {
                total: claimed.length,
                expired: claimed.filter((d: any) =>
                    d.packetId.startsWith("expired-"),
                ).length,
            };
        }

        it.each([
            [80, 5, { total: 50, expired: 5 }],
            [80, 80, { total: 50, expired: 25 }],
            [80, 0, { total: 50, expired: 0 }],
            [0, 80, { total: 50, expired: 50 }],
            [3, 2, { total: 5, expired: 2 }],
        ])("%i due + %i expired", async (due, expired, expected) => {
            expect(await seedLanes(due, expired)).toEqual(expected);
        });
    });

    describe("retry window", () => {
        async function claimAndFail(row: Seed) {
            await seed([row]);
            const engine = new DeliveryEngine() as any;
            const [claimed] = await engine.claimBatch();
            await engine.fail(claimed, subscription, "HTTP 502", 502, {});
            const [stored] = await dataSource.query(
                `SELECT status, "nextAttemptAt", "firstAttemptAt" FROM deliveries WHERE id = $1`,
                [claimed.id],
            );
            const deadLetters = Number(
                (await dataSource.query(`SELECT count(*) FROM dead_letters`))[0]
                    .count,
            );
            return { claimed, stored, deadLetters };
        }

        it("does not charge queue waiting to the retry budget", async () => {
            const threeDaysAgo = new Date(Date.now() - 72 * HOUR);
            const { claimed, stored, deadLetters } = await claimAndFail({
                packetId: "backlog",
                createdAt: threeDaysAgo,
                retryStartedAt: threeDaysAgo,
            });
            expect(
                Date.now() - new Date(claimed.firstAttemptAt).getTime(),
            ).toBeLessThan(60_000);
            expect(stored.status).toBe("failed");
            expect(new Date(stored.nextAttemptAt).getTime()).toBeGreaterThan(
                Date.now(),
            );
            expect(deadLetters).toBe(0);
        });

        it("dead-letters once the window since the first attempt has passed", async () => {
            const { stored, deadLetters } = await claimAndFail({
                packetId: "exhausted",
                createdAt: new Date(Date.now() - 26 * HOUR),
                firstAttemptAt: new Date(Date.now() - 25 * HOUR),
            });
            expect(stored.status).toBe("dead");
            expect(deadLetters).toBe(1);
        });

        it("restarts the window after an admin replay", async () => {
            const { stored, deadLetters } = await claimAndFail({
                packetId: "replayed",
                createdAt: new Date(Date.now() - 26 * HOUR),
                firstAttemptAt: new Date(Date.now() - 25 * HOUR),
                retryStartedAt: new Date(),
            });
            expect(stored.status).toBe("failed");
            expect(deadLetters).toBe(0);
        });
    });

    describe("health reporting", () => {
        const originals: Record<string, number> = {};

        beforeEach(() => {
            for (const key of [
                "deliveryPollMs",
                "workerStaleMs",
                "workerProgressStaleMs",
            ]) {
                originals[key] = config[key];
            }
            config.deliveryPollMs = 5;
            vi.spyOn(console, "error").mockImplementation(() => undefined);
            vi.spyOn(console, "log").mockImplementation(() => undefined);
        });

        afterEach(() => {
            Object.assign(config, originals);
        });

        // DeliveryEngine is imported in beforeAll, after the container starts.
        function flakyEngine() {
            return new (class extends DeliveryEngine {
                failing = true;
                async claimBatch(): Promise<any[]> {
                    if (this.failing) {
                        throw new Error(
                            "canceling statement due to statement timeout",
                        );
                    }
                    return super.claimBatch();
                }
            })();
        }

        async function runUntil(engine: any, done: () => boolean) {
            engine.start();
            const deadline = Date.now() + 5_000;
            while (!done() && Date.now() < deadline) {
                await new Promise((resolve) => setTimeout(resolve, 10));
            }
            await engine.stop();
        }

        it("is not ready while every claim fails, despite a fresh heartbeat", async () => {
            const engine = flakyEngine();
            await runUntil(
                engine,
                () =>
                    engine.status().consecutiveFailures >=
                    config.workerMaxConsecutiveFailures,
            );

            const { ready, body } = await readiness();
            expect(ready).toBe(false);
            expect(body.worker).toBe("failing");
            expect(body.workerAgeMs).toBeLessThan(config.workerStaleMs);
            expect(body.consecutiveFailures).toBeGreaterThanOrEqual(
                config.workerMaxConsecutiveFailures,
            );
            expect(body.lastError).toMatch(/statement timeout/);
            expect(workerHealth(engine.status()).state).toBe("failing");

            engine.failing = false;
            await runUntil(engine, () => engine.status().lastSuccessAt !== null);
            const recovered = await readiness();
            expect(recovered.ready).toBe(true);
            expect(recovered.body.worker).toBe("ok");
            expect(recovered.body.consecutiveFailures).toBe(0);
            expect(workerHealth(engine.status()).state).toBe("ok");
        });

        it("reports a worker without recent progress as failing", () => {
            const now = Date.now();
            expect(
                workerHealth({
                    workerId: "w",
                    startedAt: new Date(now - 10 * config.workerProgressStaleMs),
                    lastSuccessAt: new Date(
                        now - 2 * config.workerProgressStaleMs,
                    ),
                    consecutiveFailures: 0,
                    lastError: null,
                }).state,
            ).toBe("failing");
            expect(
                workerHealth({
                    workerId: "w",
                    startedAt: new Date(now - 1_000),
                    lastSuccessAt: null,
                    consecutiveFailures: 0,
                    lastError: null,
                }).state,
            ).toBe("ok");
        });

        it("reports queue age and capped counts from the active queue only", async () => {
            await seed([
                {
                    packetId: "stats",
                    createdAt: new Date(Date.now() - 2 * HOUR),
                    nextAttemptAt: new Date(Date.now() - HOUR),
                },
                {
                    packetId: "stats-expired",
                    status: "delivering",
                    leaseToken: "00000000-0000-4000-8000-000000000002",
                    leaseExpiresAt: new Date(Date.now() - 1_000),
                },
                {
                    packetId: "stats-old-history",
                    status: "delivered",
                    createdAt: new Date(Date.now() - 500 * HOUR),
                },
            ]);
            await dataSource.query(`
                INSERT INTO deliveries ("subscriptionId", "packetId", "eventId", "contentHash", status)
                SELECT '${subscription.id}', 'cap-' || g, 'cap-event-' || g, 'hash', 'failed'
                FROM generate_series(1, 10050) g
            `);
            const stats = await queueStats();
            expect(stats.pending).toBe("1");
            expect(stats.failed).toBe("10000");
            expect(stats.delivering).toBe("1");
            expect(stats.expired_leases).toBe("1");
            expect(Number(stats.oldest_pending_seconds)).toBeGreaterThan(7_000);
            expect(Number(stats.oldest_pending_seconds)).toBeLessThan(8_000);
            expect(Number(stats.oldest_due_seconds)).toBeGreaterThan(3_500);
        });
    });

    it("plans the exact claim UPDATE on partial indexes over large delivery history", async () => {
        const sub = subscription.id;
        // History: delivered/dead rows whose nextAttemptAt is long past, which
        // is exactly what the full idx_deliveries_next_attempt scan waded through.
        await dataSource.query(`
            INSERT INTO deliveries ("subscriptionId", "packetId", "eventId", "contentHash",
                status, attempts, "nextAttemptAt", "createdAt", "retryStartedAt", "deliveredAt")
            SELECT '${sub}', 'hist-' || (g % 50000), 'hist-event-' || g, 'hash',
                CASE WHEN g % 15 = 0 THEN 'dead' ELSE 'delivered' END, 1,
                now() - make_interval(secs => g * 5), now() - make_interval(secs => g * 5),
                now() - make_interval(secs => g * 5), now() - make_interval(secs => g * 5)
            FROM generate_series(1, 300000) g
        `);
        // Active backlog: two events per stream (half the rows are blocked
        // successors), a third not yet due.
        await dataSource.query(`
            INSERT INTO deliveries ("subscriptionId", "packetId", "eventId", "contentHash",
                status, attempts, "nextAttemptAt", "createdAt", "retryStartedAt")
            SELECT '${sub}', 'active-' || (g % 1500), 'active-event-' || g, 'hash',
                CASE WHEN g % 2 = 0 THEN 'failed' ELSE 'pending' END, g % 3,
                CASE WHEN g % 3 = 0 THEN now() + interval '1 hour'
                     ELSE now() - make_interval(secs => g) END,
                now() - interval '3 days' + make_interval(secs => g),
                now() - interval '3 days' + make_interval(secs => g)
            FROM generate_series(1, 3000) g
        `);
        await dataSource.query(`
            INSERT INTO deliveries ("subscriptionId", "packetId", "eventId", "contentHash",
                status, "createdAt", "leaseOwner", "leaseToken", "leaseExpiresAt")
            SELECT '${sub}', 'leased-' || g, 'leased-event-' || g, 'hash', 'delivering',
                now() - interval '1 hour', 'worker', gen_random_uuid(),
                CASE WHEN g % 2 = 0 THEN now() - interval '1 minute'
                     ELSE now() + interval '1 minute' END
            FROM generate_series(1, 50) g
        `);
        await dataSource.query(`VACUUM ANALYZE deliveries`);

        const [sql, params] = buildClaimQuery(
            BATCH_SIZE,
            "plan-worker",
            "00000000-0000-4000-8000-000000000003",
            new Date(Date.now() + 30_000),
        );
        const runner = dataSource.createQueryRunner();
        try {
            const [{ "QUERY PLAN": plan }] = await runner.query(
                `EXPLAIN (FORMAT JSON) ${sql}`,
                params,
            );
            const nodes: any[] = [];
            const walk = (node: any) => {
                nodes.push(node);
                for (const child of node.Plans ?? []) walk(child);
            };
            walk(plan[0].Plan);
            const indexes = new Set(
                nodes.map((node) => node["Index Name"]).filter(Boolean),
            );
            expect(indexes).toContain("idx_deliveries_claim_due");
            expect(indexes).toContain("idx_deliveries_expired_lease");
            expect(indexes).toContain("idx_deliveries_active_stream_order");
            expect(indexes).not.toContain("idx_deliveries_next_attempt");
            expect(
                nodes.filter(
                    (node) =>
                        node["Node Type"] === "Seq Scan" &&
                        node["Relation Name"] === "deliveries",
                ),
            ).toEqual([]);

            // Execute the real statement, then roll it back, to capture buffers.
            await runner.startTransaction();
            const analyzed = await runner.query(
                `EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT) ${sql}`,
                params,
            );
            await runner.rollbackTransaction();
            const text = analyzed
                .map((row: any) => row["QUERY PLAN"])
                .join("\n");
            console.info(`[claim plan]\n${text}`);
            const executionMs = Number(
                /Execution Time: ([\d.]+) ms/.exec(text)?.[1],
            );
            expect(executionMs).toBeLessThan(500);
        } finally {
            await runner.release();
        }

        const claimed = await (new DeliveryEngine() as any).claimBatch();
        expect(claimed).toHaveLength(BATCH_SIZE);
        expect(
            claimed.filter((d: any) => d.packetId.startsWith("leased-")),
        ).toHaveLength(25);
    }, 120_000);
});
