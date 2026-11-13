import { randomUUID } from "node:crypto";
import axios from "axios";
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

/** The two queues a claim drains, each with its own index and sort key. */
export type ClaimLane = "due" | "expired";

/** An earlier unfinished event on the same packet stream. */
const ACTIVE_PREDECESSOR = `
    MATCH (earlier:AwarenessOutbox)
    WHERE earlier.packetId = a.packetId
      AND earlier.status IN ['pending', 'failed', 'delivering']
      AND earlier.streamVersion < a.streamVersion`;

/**
 * One lane of candidate discovery: ids only, no predecessor check.
 *
 * Claiming used to select candidates with a single OR over two different
 * property pairs (`status`/`nextAttemptAt` and `status`/`leaseExpiresAt`), which
 * no index can serve, then run the correlated predecessor check against every
 * scanned node before applying LIMIT. On a 393k-node outbox that meant a full
 * label scan per cycle and the dispatcher stopped draining entirely.
 *
 * Splitting the OR gives each lane its own index seek, and the sort key is the
 * indexed range key so Neo4j can stop early instead of collecting and sorting.
 * The predecessor check moves to {@link buildLeaseQuery}, where it runs against
 * a bounded page rather than the whole label.
 *
 * Paging is a keyset (`sortKey >= after`, minus the ids already taken at exactly
 * `after`), never SKIP: claimed rows leave the result set, so SKIP would step
 * over rows it never examined and starve them.
 */
export function buildCandidateQuery(lane: ClaimLane): string {
    const due = lane === "due";
    const status = due
        ? "a.status IN ['pending', 'failed']"
        : "a.status = 'delivering'";
    const sortKey = due ? "a.nextAttemptAt" : "a.leaseExpiresAt";
    return `MATCH (a:AwarenessOutbox)
            WHERE ${status}
              AND ${sortKey} >= $after AND ${sortKey} <= $now
              AND NOT a.eventId IN $exclude
            RETURN a.eventId AS eventId, ${sortKey} AS sortKey
            ORDER BY ${sortKey}, a.eventId
            LIMIT $page`;
}

/** Eligible for dispatch: due work, or a lease nobody is holding any more. */
const ELIGIBLE = `((a.status IN ['pending', 'failed'] AND a.nextAttemptAt <= $now)
                OR (a.status = 'delivering' AND a.leaseExpiresAt <= $now))`;

/**
 * Narrows one candidate page to the events that would actually be claimed.
 *
 * Read-only, so it costs nothing beyond the predecessor check, and it is what
 * keeps {@link buildLeaseQuery}'s lock probe bounded: the write transaction
 * touches at most `limit` nodes rather than the whole page.
 *
 * `a` is pinned by `eventId` (unique constraint), so this is one index seek per
 * candidate plus one `awareness_outbox_stream` seek for the predecessor check.
 */
export function buildShortlistQuery(): string {
    return `UNWIND $eventIds AS eventId
            MATCH (a:AwarenessOutbox { eventId: eventId })
            WHERE ${ELIGIBLE}
              AND NOT EXISTS {${ACTIVE_PREDECESSOR}
              }
            RETURN a.eventId AS eventId
            ORDER BY a.nextAttemptAt, a.createdAt
            LIMIT $limit`;
}

/**
 * Leases the shortlist, taking an exclusive lock on each row before reading the
 * state it is judged on.
 *
 * That ordering is the whole point. Neo4j acquires the node write lock at SET
 * time, so a plain `MATCH ... WHERE ... SET` lets every concurrent dispatcher
 * evaluate the predicate against state that was current when it read but stale
 * by the time it writes - and all of them then claim the same events. Writing
 * `claimProbe` first forces the lock, so a dispatcher that loses the race reads
 * the winner's `delivering` status and filters itself out.
 *
 * `claimProbe` exists only to take that lock and is never read; it is written
 * before the predicate, so it must be a property no one relies on. Writing
 * `leaseToken` here instead would clobber the winner's token and break the
 * fencing in {@link AwarenessOutboxDispatcher.finish}.
 *
 * The predecessor lookup is deliberately left unlocked: its blocking set is
 * `pending`/`failed`/`delivering`, and the only way out of that set is genuine
 * completion, so a concurrent claim of a predecessor keeps it blocking.
 */
export function buildLeaseQuery(): string {
    return `UNWIND $eventIds AS eventId
            MATCH (a:AwarenessOutbox { eventId: eventId })
            SET a.claimProbe = $leaseToken
            WITH a
            WHERE ${ELIGIBLE}
              AND NOT EXISTS {${ACTIVE_PREDECESSOR}
              }
            SET a.status = 'delivering',
                a.leaseOwner = $workerId,
                a.leaseToken = $leaseToken,
                a.leaseExpiresAt = $leaseExpiresAt
            RETURN a`;
}

/** How far one lane has been read within a single claim cycle. */
interface LaneCursor {
    after: number;
    exclude: string[];
    drained: boolean;
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
    private readonly candidatePageSize = positiveInteger(
        process.env.AWARENESS_OUTBOX_CANDIDATE_PAGE,
        500,
    );
    private readonly maxClaimPages = positiveInteger(
        process.env.AWARENESS_OUTBOX_MAX_CLAIM_PAGES,
        10,
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

    /**
     * Fills a batch a page at a time: discover bounded candidates, lease the
     * eligible ones, and keep going while the batch is short.
     *
     * Paging is what stops blocked events starving eligible ones. A page whose
     * candidates all sit behind an unfinished predecessor leases nothing, but it
     * still advances the lane cursor, so the next page reaches events further
     * down the queue within the same cycle.
     */
    private async claim(limit: number): Promise<ClaimedEvent[]> {
        if (!process.env.AWARENESS_SERVICE_URL) return [];
        const now = Date.now();
        const lanes: Record<ClaimLane, LaneCursor> = {
            expired: { after: 0, exclude: [], drained: false },
            due: { after: 0, exclude: [], drained: false },
        };
        const claimed: ClaimedEvent[] = [];
        for (
            let page = 0;
            page < this.maxClaimPages && claimed.length < limit;
            page++
        ) {
            const candidates = await this.nextCandidates(lanes, now);
            if (candidates.length === 0) break;
            claimed.push(
                ...(await this.lease(candidates, now, limit - claimed.length)),
            );
        }
        return claimed;
    }

    /**
     * One page of candidate ids per live lane, interleaved round-robin with
     * expired leases first so a deep due backlog cannot starve lease recovery.
     * Advances each lane's cursor past what it returned.
     */
    private async nextCandidates(
        lanes: Record<ClaimLane, LaneCursor>,
        now: number,
    ): Promise<string[]> {
        const session = this.driver.session({
            defaultAccessMode: neo4j.session.READ,
        });
        const pages: Record<ClaimLane, string[]> = { expired: [], due: [] };
        try {
            for (const lane of ["expired", "due"] as const) {
                const cursor = lanes[lane];
                if (cursor.drained) continue;
                const result = await session.executeRead(
                    (tx) =>
                        tx.run(buildCandidateQuery(lane), {
                            now,
                            after: cursor.after,
                            exclude: cursor.exclude,
                            page: neo4j.int(this.candidatePageSize),
                        }),
                    { timeout: this.dbTimeoutMs },
                );
                const rows = result.records.map((record) => ({
                    eventId: record.get("eventId") as string,
                    sortKey: numberValue(record.get("sortKey")),
                }));
                if (rows.length < this.candidatePageSize) cursor.drained = true;
                const last = rows[rows.length - 1];
                if (last) {
                    // Rows sharing the cursor's sort key can only be excluded by
                    // id; every lower key is already behind us.
                    cursor.exclude =
                        last.sortKey === cursor.after
                            ? [...cursor.exclude, ...rows.map((r) => r.eventId)]
                            : rows
                                  .filter((r) => r.sortKey === last.sortKey)
                                  .map((r) => r.eventId);
                    cursor.after = last.sortKey;
                }
                pages[lane] = rows.map((r) => r.eventId);
            }
        } finally {
            await session.close();
        }
        const merged: string[] = [];
        const depth = Math.max(pages.expired.length, pages.due.length);
        for (let i = 0; i < depth; i++) {
            if (i < pages.expired.length) merged.push(pages.expired[i]);
            if (i < pages.due.length) merged.push(pages.due[i]);
        }
        return merged;
    }

    /**
     * Leases whichever candidates are still eligible, up to `limit`.
     *
     * Shortlisting first keeps the write transaction's lock probe proportional
     * to the batch rather than to the candidate page.
     */
    private async lease(
        eventIds: string[],
        now: number,
        limit: number,
    ): Promise<ClaimedEvent[]> {
        const leaseToken = randomUUID();
        const session = this.driver.session();
        try {
            const shortlist = await session.executeRead(
                (tx) =>
                    tx.run(buildShortlistQuery(), {
                        eventIds,
                        now,
                        limit: neo4j.int(limit),
                    }),
                { timeout: this.dbTimeoutMs },
            );
            const shortlisted = shortlist.records.map(
                (record) => record.get("eventId") as string,
            );
            if (shortlisted.length === 0) return [];

            const result = await session.executeWrite(
                (tx) =>
                    tx.run(buildLeaseQuery(), {
                        eventIds: shortlisted,
                        now,
                        workerId: this.workerId,
                        leaseToken,
                        leaseExpiresAt: Date.now() + this.leaseMs,
                    }),
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
