import {
    Neo4jContainer,
    type StartedNeo4jContainer,
} from "@testcontainers/neo4j";
import neo4j, { type Driver } from "neo4j-driver";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createAwarenessOutboxIndexes } from "../db/migrations/add-awareness-outbox-indexes";
import { AwarenessOutboxDispatcher } from "./awareness-outbox-dispatcher";

interface SeedEvent {
    eventId: string;
    packetId: string;
    streamVersion: number;
    status: "pending" | "failed" | "delivering" | "delivered";
    nextAttemptAt: number;
    leaseExpiresAt?: number;
    leaseToken?: string;
}

/**
 * Claiming is exercised directly rather than through the delivery loop: these
 * are the invariants the claim query has to hold on its own, independent of
 * whether AaaS answers.
 */
describe("AwarenessOutboxDispatcher claim (integration)", () => {
    let container: StartedNeo4jContainer;
    let driver: Driver;
    // Real clock: the dispatcher compares against Date.now(), so a fixed past
    // constant would make every "live" lease look long expired.
    const now = Date.now();

    beforeAll(async () => {
        container = await new Neo4jContainer("neo4j:5.15").start();
        driver = neo4j.driver(
            `bolt://localhost:${container.getMappedPort(7687)}`,
            neo4j.auth.basic(container.getUsername(), container.getPassword()),
        );
        await createAwarenessOutboxIndexes(driver);
        // Without this the dispatcher treats itself as unconfigured and claims
        // nothing. Nothing is ever POSTed here - deliver() is never called.
        process.env.AWARENESS_SERVICE_URL = "http://localhost:9999";
    }, 120000);

    afterAll(async () => {
        await driver?.close();
        await container?.stop();
    });

    beforeEach(async () => {
        const session = driver.session();
        try {
            await session.run("MATCH (a:AwarenessOutbox) DELETE a");
        } finally {
            await session.close();
        }
    });

    async function seed(events: SeedEvent[]): Promise<void> {
        const session = driver.session();
        try {
            await session.run(
                `UNWIND $events AS e
                 CREATE (a:AwarenessOutbox {
                     eventId: e.eventId,
                     packetId: e.packetId,
                     schemaId: 'test-ontology',
                     w3id: '@test',
                     evaultPublicKey: null,
                     dataJson: '{}',
                     operation: 'create',
                     requestingPlatform: null,
                     occurredAt: '2026-01-01T00:00:00.000Z',
                     streamVersion: e.streamVersion,
                     status: e.status,
                     attempts: 0,
                     nextAttemptAt: e.nextAttemptAt,
                     createdAt: e.nextAttemptAt
                 })
                 WITH a, e
                 WHERE e.leaseExpiresAt IS NOT NULL
                 SET a.leaseExpiresAt = e.leaseExpiresAt,
                     a.leaseOwner = 'someone-else',
                     a.leaseToken = e.leaseToken`,
                {
                    events: events.map((e) => ({
                        ...e,
                        streamVersion: neo4j.int(e.streamVersion),
                    })),
                },
            );
        } finally {
            await session.close();
        }
    }

    /** `claim` and `finish` are internal; the tests drive them deliberately. */
    function dispatcher(env: Record<string, string> = {}): any {
        for (const [key, value] of Object.entries(env))
            process.env[key] = value;
        const instance = new AwarenessOutboxDispatcher(driver) as any;
        for (const key of Object.keys(env)) delete process.env[key];
        return instance;
    }

    async function statusOf(eventId: string): Promise<string> {
        const session = driver.session();
        try {
            const result = await session.run(
                "MATCH (a:AwarenessOutbox { eventId: $eventId }) RETURN a.status AS status",
                { eventId },
            );
            return result.records[0]?.get("status");
        } finally {
            await session.close();
        }
    }

    it("claims only the head of each packet stream", async () => {
        await seed([
            {
                eventId: "a1",
                packetId: "A",
                streamVersion: 1,
                status: "pending",
                nextAttemptAt: now - 300,
            },
            {
                eventId: "a2",
                packetId: "A",
                streamVersion: 2,
                status: "pending",
                nextAttemptAt: now - 200,
            },
            {
                eventId: "a3",
                packetId: "A",
                streamVersion: 3,
                status: "pending",
                nextAttemptAt: now - 100,
            },
            {
                eventId: "b1",
                packetId: "B",
                streamVersion: 1,
                status: "pending",
                nextAttemptAt: now - 250,
            },
        ]);

        const claimed = await dispatcher().claim(50);

        expect(claimed.map((e: any) => e.eventId).sort()).toEqual(["a1", "b1"]);
    });

    it("reclaims an expired lease but leaves a live one alone", async () => {
        await seed([
            {
                eventId: "stale",
                packetId: "A",
                streamVersion: 1,
                status: "delivering",
                nextAttemptAt: now - 500,
                leaseExpiresAt: now - 1,
                leaseToken: "old-token",
            },
            {
                eventId: "live",
                packetId: "B",
                streamVersion: 1,
                status: "delivering",
                nextAttemptAt: now - 500,
                leaseExpiresAt: now + 600_000,
                leaseToken: "live-token",
            },
        ]);

        const claimed = await dispatcher().claim(50);

        expect(claimed.map((e: any) => e.eventId)).toEqual(["stale"]);
    });

    it("does not let blocked candidates starve eligible events", async () => {
        // Packet A's head is in flight on a live lease, so versions 2-5 are all
        // blocked - and they sort ahead of packet B. With a page size of two
        // they fill the first two pages on their own; B is only reachable if a
        // page that leases nothing still advances the cursor.
        await seed([
            {
                eventId: "a1",
                packetId: "A",
                streamVersion: 1,
                status: "delivering",
                nextAttemptAt: now - 900,
                leaseExpiresAt: now + 600_000,
                leaseToken: "in-flight",
            },
            {
                eventId: "a2",
                packetId: "A",
                streamVersion: 2,
                status: "pending",
                nextAttemptAt: now - 800,
            },
            {
                eventId: "a3",
                packetId: "A",
                streamVersion: 3,
                status: "pending",
                nextAttemptAt: now - 700,
            },
            {
                eventId: "a4",
                packetId: "A",
                streamVersion: 4,
                status: "pending",
                nextAttemptAt: now - 600,
            },
            {
                eventId: "a5",
                packetId: "A",
                streamVersion: 5,
                status: "pending",
                nextAttemptAt: now - 500,
            },
            {
                eventId: "b1",
                packetId: "B",
                streamVersion: 1,
                status: "pending",
                nextAttemptAt: now - 100,
            },
        ]);

        const claimed = await dispatcher({
            AWARENESS_OUTBOX_CANDIDATE_PAGE: "2",
        }).claim(50);

        expect(claimed.map((e: any) => e.eventId)).toEqual(["b1"]);
    });

    it("pages through a backlog larger than one candidate page", async () => {
        await seed(
            Array.from({ length: 40 }, (_, i) => ({
                eventId: `e${i}`,
                packetId: `P${i}`,
                streamVersion: 1,
                status: "pending" as const,
                nextAttemptAt: now - 1_000 + i,
            })),
        );

        const claimed = await dispatcher({
            AWARENESS_OUTBOX_CANDIDATE_PAGE: "5",
        }).claim(40);

        expect(new Set(claimed.map((e: any) => e.eventId)).size).toBe(40);
    });

    it("fences a stolen lease so the previous owner cannot complete it", async () => {
        await seed([
            {
                eventId: "a1",
                packetId: "A",
                streamVersion: 1,
                status: "delivering",
                nextAttemptAt: now - 500,
                leaseExpiresAt: now - 1,
                leaseToken: "old-token",
            },
        ]);
        const worker = dispatcher();
        const [reclaimed] = await worker.claim(50);
        expect(reclaimed.leaseToken).not.toBe("old-token");

        // The original owner finishing late must not move the event, or a
        // reclaimed event would be acknowledged twice.
        await worker.finish(
            { ...reclaimed, leaseToken: "old-token" },
            true,
            null,
        );
        expect(await statusOf("a1")).toBe("delivering");

        await worker.finish(reclaimed, true, null);
        expect(await statusOf("a1")).toBe("delivered");
    });
});
