import axios from "axios";
import { randomUUID } from "node:crypto";
import neo4j, { type Driver } from "neo4j-driver";

interface ClaimedEvent {
    eventId: string;
    packetId: string;
    schemaId: string;
    w3id: string;
    evaultPublicKey: string | null;
    dataJson: string;
    operation: "create" | "update" | "delete";
    requestingPlatform: string | null;
    occurredAt: string;
    streamVersion: number;
    attempts: number;
    leaseToken: string;
}

const RETRY_SCHEDULE = [
    1_000, 5_000, 30_000, 60_000, 120_000, 300_000, 900_000, 3_600_000,
    21_600_000, 86_400_000,
];

function delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function numberValue(value: any): number {
    return typeof value?.toNumber === "function"
        ? value.toNumber()
        : Number(value);
}

function positiveInteger(raw: string | undefined, fallback: number): number {
    const value = Number(raw);
    return Number.isSafeInteger(value) && value > 0 ? value : fallback;
}

/**
 * Drains Neo4j awareness outbox rows until AaaS durably acknowledges them.
 * Unlike the old resolver-level POST, failures survive process restarts.
 */
export class AwarenessOutboxDispatcher {
    private stopping = false;
    private loop?: Promise<void>;
    private readonly workerId =
        `${process.env.HOSTNAME ?? "evault"}-${process.pid}`;
    private readonly pollMs = positiveInteger(
        process.env.AWARENESS_OUTBOX_POLL_MS,
        1_000,
    );
    private readonly leaseMs = positiveInteger(
        process.env.AWARENESS_OUTBOX_LEASE_MS,
        30_000,
    );
    private readonly dbTimeoutMs = positiveInteger(
        process.env.AWARENESS_OUTBOX_DB_TIMEOUT_MS,
        10_000,
    );
    private lastCycleAt: Date | null = null;
    private lastError: string | null = null;

    constructor(private readonly driver: Driver) {}

    start(): void {
        if (this.loop) return;
        this.stopping = false;
        this.loop = this.run();
        console.log(`[awareness-outbox] dispatcher ${this.workerId} started`);
    }

    async stop(): Promise<void> {
        this.stopping = true;
        await this.loop;
        this.loop = undefined;
    }

    health(): {
        configured: boolean;
        running: boolean;
        workerId: string;
        lastCycleAt: Date | null;
        lastError: string | null;
    } {
        return {
            configured: Boolean(process.env.AWARENESS_SERVICE_URL),
            running: Boolean(this.loop) && !this.stopping,
            workerId: this.workerId,
            lastCycleAt: this.lastCycleAt,
            lastError: this.lastError,
        };
    }

    private async run(): Promise<void> {
        while (!this.stopping) {
            try {
                const events = await this.claim(50);
                const results = await Promise.allSettled(
                    events.map((event) => this.deliver(event)),
                );
                const rejected = results.filter(
                    (result) => result.status === "rejected",
                );
                if (rejected.length > 0) {
                    const first = rejected[0] as PromiseRejectedResult;
                    throw new Error(
                        `${rejected.length} outbox completion(s) failed; leases will be reclaimed: ${first.reason instanceof Error ? first.reason.message : String(first.reason)}`,
                    );
                }
                await this.cleanupAcknowledged();
                this.lastError = null;
            } catch (error) {
                this.lastError =
                    error instanceof Error ? error.message : String(error);
                console.error(
                    "[awareness-outbox] dispatch cycle failed:",
                    error,
                );
            } finally {
                this.lastCycleAt = new Date();
            }
            if (!this.stopping) await delay(this.pollMs);
        }
    }

    private async claim(limit: number): Promise<ClaimedEvent[]> {
        if (!process.env.AWARENESS_SERVICE_URL) return [];
        const now = Date.now();
        const leaseToken = randomUUID();
        const session = this.driver.session();
        try {
            const result = await session.executeWrite(
                (tx) =>
                    tx.run(
                        `MATCH (a:AwarenessOutbox)
                     WHERE (a.status IN ['pending', 'failed'] AND a.nextAttemptAt <= $now)
                        OR (a.status = 'delivering' AND a.leaseExpiresAt <= $now)
                     WITH a
                     WHERE NOT EXISTS {
                         MATCH (earlier:AwarenessOutbox)
                         WHERE earlier.packetId = a.packetId
                           AND earlier.status IN ['pending', 'failed', 'delivering']
                           AND earlier.streamVersion < a.streamVersion
                     }
                     WITH a ORDER BY a.nextAttemptAt, a.createdAt LIMIT $limit
                     SET a.status = 'delivering',
                         a.leaseOwner = $workerId,
                         a.leaseToken = $leaseToken,
                         a.leaseExpiresAt = $leaseExpiresAt
                     RETURN a`,
                        {
                            now,
                            limit: neo4j.int(limit),
                            workerId: this.workerId,
                            leaseToken,
                            leaseExpiresAt: now + this.leaseMs,
                        },
                    ),
                { timeout: this.dbTimeoutMs },
            );
            return result.records.map((record) => {
                const p = record.get("a").properties;
                return {
                    eventId: p.eventId,
                    packetId: p.packetId,
                    schemaId: p.schemaId,
                    w3id: p.w3id,
                    evaultPublicKey: p.evaultPublicKey ?? null,
                    dataJson: p.dataJson,
                    operation: p.operation,
                    requestingPlatform: p.requestingPlatform ?? null,
                    occurredAt: p.occurredAt,
                    streamVersion: numberValue(p.streamVersion),
                    attempts: numberValue(p.attempts),
                    leaseToken,
                };
            });
        } finally {
            await session.close();
        }
    }

    private async deliver(event: ClaimedEvent): Promise<void> {
        try {
            const ingestUrl = new URL(
                "/ingest",
                process.env.AWARENESS_SERVICE_URL!,
            ).toString();
            await axios.post(
                ingestUrl,
                {
                    eventId: event.eventId,
                    id: event.packetId,
                    w3id: event.w3id,
                    evaultPublicKey: event.evaultPublicKey,
                    data: JSON.parse(event.dataJson),
                    schemaId: event.schemaId,
                    operation: event.operation,
                    requestingPlatform: event.requestingPlatform,
                    occurredAt: event.occurredAt,
                    streamVersion: event.streamVersion,
                },
                {
                    headers: {
                        "Content-Type": "application/json",
                        "x-ingest-secret":
                            process.env.AWARENESS_INGEST_SECRET ?? "",
                    },
                    timeout: 5000,
                },
            );
        } catch (error: any) {
            await this.finish(
                event,
                false,
                `${error?.response?.status ?? error?.code ?? "error"}: ${error?.message ?? String(error)}`,
            );
            return;
        }
        await this.finish(event, true, null);
    }

    private async finish(
        event: ClaimedEvent,
        delivered: boolean,
        error: string | null,
    ): Promise<void> {
        const attempts = event.attempts + 1;
        const base =
            RETRY_SCHEDULE[Math.min(attempts - 1, RETRY_SCHEDULE.length - 1)];
        const jitter = base * (Math.random() * 0.2 - 0.1);
        const session = this.driver.session();
        try {
            await session.executeWrite(
                (tx) =>
                    tx.run(
                        `MATCH (a:AwarenessOutbox { eventId: $eventId, leaseToken: $leaseToken })
                     SET a.status = $status,
                         a.attempts = $attempts,
                         a.lastError = $error,
                         a.nextAttemptAt = $nextAttemptAt,
                         a.acknowledgedAt = $acknowledgedAt,
                         a.leaseOwner = null,
                         a.leaseToken = null,
                         a.leaseExpiresAt = null`,
                        {
                            eventId: event.eventId,
                            leaseToken: event.leaseToken,
                            status: delivered ? "delivered" : "failed",
                            attempts,
                            error,
                            nextAttemptAt: delivered
                                ? Date.now()
                                : Date.now() + base + jitter,
                            acknowledgedAt: delivered ? Date.now() : null,
                        },
                    ),
                { timeout: this.dbTimeoutMs },
            );
        } finally {
            await session.close();
        }
    }

    private async cleanupAcknowledged(): Promise<void> {
        const retentionMs = positiveInteger(
            process.env.AWARENESS_OUTBOX_RETENTION_MS,
            7 * 24 * 60 * 60 * 1000,
        );
        const session = this.driver.session();
        try {
            await session.executeWrite(
                (tx) =>
                    tx.run(
                        `MATCH (a:AwarenessOutbox { status: 'delivered' })
                     WHERE a.acknowledgedAt < $before
                     WITH a LIMIT 500
                     DELETE a`,
                        { before: Date.now() - retentionMs },
                    ),
                { timeout: this.dbTimeoutMs },
            );
        } finally {
            await session.close();
        }
    }
}
