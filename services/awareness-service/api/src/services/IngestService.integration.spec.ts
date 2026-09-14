import { PostgreSqlContainer } from "@testcontainers/postgresql";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { StartedPostgreSqlContainer } from "@testcontainers/postgresql";

describe("durable awareness ingest", () => {
    let container: StartedPostgreSqlContainer;
    let dataSource: any;
    let IngestService: any;
    let Consumer: any;
    let Subscription: any;
    let AwarenessEvent: any;
    let Delivery: any;
    let EventIdConflictError: any;
    let queueStats: () => Promise<any>;
    let DeliveryEngine: any;

    beforeAll(async () => {
        container = await new PostgreSqlContainer("postgres:16-alpine").start();
        process.env.AWARENESS_DATABASE_URL = container.getConnectionUri();
        process.env.PUBLIC_REGISTRY_URL = "";
        ({ AppDataSource: dataSource } = await import(
            "../database/data-source"
        ));
        ({ IngestService, EventIdConflictError } = await import(
            "./IngestService"
        ));
        ({ queueStats } = await import("../controllers/SystemController"));
        ({ DeliveryEngine } = await import("./DeliveryEngine"));
        ({ Consumer } = await import("../database/entities/Consumer"));
        ({ Subscription } = await import("../database/entities/Subscription"));
        ({ AwarenessEvent } = await import(
            "../database/entities/AwarenessEvent"
        ));
        ({ Delivery } = await import("../database/entities/Delivery"));
        await dataSource.initialize();
        await dataSource.runMigrations();

        const consumer = await dataSource.getRepository(Consumer).save({
            ename: "catchall:test.example",
            name: "test",
            status: "approved",
            webhookBaseUrl: "https://test.example",
            approvedAt: new Date(),
        });
        await dataSource.getRepository(Subscription).save({
            consumerId: consumer.id,
            targetUrl: "https://test.example/api/webhook",
            ontologyFilter: [],
            evaultFilter: [],
            isCatchAll: true,
            active: true,
            secret: null,
        });
    }, 120_000);

    afterAll(async () => {
        if (dataSource?.isInitialized) await dataSource.destroy();
        if (container) await container.stop();
    });

    it("migrates a fresh database and commits event plus deliveries atomically", async () => {
        const service = new IngestService();
        const result = await service.ingest({
            eventId: "event-atomic-1",
            id: "envelope-atomic",
            schemaId: "schema-test",
            w3id: "@owner",
            data: { state: "A" },
            operation: "create",
            streamVersion: 1,
            occurredAt: new Date().toISOString(),
        });

        expect(result).toMatchObject({
            eventId: "event-atomic-1",
            duplicate: false,
            deliveriesQueued: 1,
        });
        expect(await dataSource.getRepository(AwarenessEvent).count()).toBe(1);
        expect(await dataSource.getRepository(Delivery).count()).toBe(1);

        const duplicate = await service.ingest({
            eventId: "event-atomic-1",
            id: "envelope-atomic",
            schemaId: "schema-test",
            w3id: "@owner",
            data: { state: "A" },
            operation: "create",
            streamVersion: 1,
        });
        expect(duplicate.duplicate).toBe(true);
        expect(await dataSource.getRepository(Delivery).count()).toBe(1);

        await expect(
            service.ingest({
                eventId: "event-atomic-1",
                id: "envelope-atomic",
                schemaId: "schema-test",
                w3id: "@owner",
                data: { state: "different" },
                operation: "create",
                streamVersion: 1,
            }),
        ).rejects.toBeInstanceOf(EventIdConflictError);

        const stats = await queueStats();
        expect(Number(stats.pending)).toBeGreaterThan(0);
        expect(Number(stats.oldest_pending_seconds)).toBeGreaterThanOrEqual(0);
    });

    it("does not collapse a legitimate A to B to A event sequence", async () => {
        const service = new IngestService();
        for (const [index, state] of ["A", "B", "A"].entries()) {
            await service.ingest({
                eventId: `event-sequence-${index + 1}`,
                id: "envelope-sequence",
                schemaId: "schema-test",
                data: { state },
                operation: index === 0 ? "create" : "update",
                streamVersion: index + 1,
            });
        }
        const events = await dataSource.getRepository(AwarenessEvent).find({
            where: { packetId: "envelope-sequence" },
        });
        const deliveries = await dataSource.getRepository(Delivery).find({
            where: { packetId: "envelope-sequence" },
        });
        expect(events).toHaveLength(3);
        expect(deliveries).toHaveLength(3);
    });

    it("reclaims expired leases with token fencing and preserves stream order", async () => {
        const service = new IngestService();
        await service.ingest({
            eventId: "event-lease-1",
            id: "envelope-lease",
            schemaId: "schema-test",
            data: { version: 1 },
            streamVersion: 1,
        });
        await service.ingest({
            eventId: "event-lease-2",
            id: "envelope-lease",
            schemaId: "schema-test",
            data: { version: 2 },
            operation: "update",
            streamVersion: 2,
        });

        const deliveryRepo = dataSource.getRepository(Delivery);
        const [first, second] = await deliveryRepo.find({
            where: { packetId: "envelope-lease" },
            order: { createdAt: "ASC" },
        });
        const staleToken = "00000000-0000-4000-8000-000000000001";
        await deliveryRepo.update(first.id, {
            createdAt: new Date(Date.now() - 2_000),
            status: "delivering",
            leaseToken: staleToken,
            leaseOwner: "dead-worker",
            leaseExpiresAt: new Date(Date.now() - 1_000),
        });
        await deliveryRepo.update(second.id, {
            createdAt: new Date(Date.now() - 1_000),
            status: "pending",
            nextAttemptAt: new Date(Date.now() - 1_000),
        });

        const engine = new DeliveryEngine() as any;
        const firstClaim = await engine.claimBatch();
        const streamClaims = firstClaim.filter(
            (delivery: any) => delivery.packetId === "envelope-lease",
        );
        expect(streamClaims.map((delivery: any) => delivery.eventId)).toEqual([
            "event-lease-1",
        ]);

        const staleCompletion = await deliveryRepo.update(
            { id: first.id, leaseToken: staleToken },
            { status: "delivered" },
        );
        expect(staleCompletion.affected).toBe(0);

        const activeLease = streamClaims[0].leaseToken;
        await deliveryRepo.update(
            { id: first.id, leaseToken: activeLease },
            {
                status: "delivered",
                leaseToken: null,
                leaseOwner: null,
                leaseExpiresAt: null,
            },
        );
        const secondClaim = await engine.claimBatch();
        expect(
            secondClaim
                .filter(
                    (delivery: any) => delivery.packetId === "envelope-lease",
                )
                .map((delivery: any) => delivery.eventId),
        ).toEqual(["event-lease-2"]);
    });
});
