import type { MigrationInterface, QueryRunner } from "typeorm";

/** Immutable events, token-fenced delivery leases and cross-process health. */
export class DurableAwarenessEvents1789430400000 implements MigrationInterface {
    name = "DurableAwarenessEvents1789430400000";

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "awareness_events" (
                "eventId" varchar NOT NULL,
                "packetId" varchar NOT NULL,
                "ontology" varchar NOT NULL,
                "evaultPublicKey" varchar,
                "w3id" varchar,
                "data" jsonb,
                "operation" varchar NOT NULL DEFAULT 'create',
                "streamVersion" bigint,
                "requestingPlatform" varchar,
                "occurredAt" timestamptz NOT NULL,
                "receivedAt" timestamptz NOT NULL DEFAULT now(),
                CONSTRAINT "PK_awareness_events" PRIMARY KEY ("eventId")
            )
        `);
        await queryRunner.query(
            `CREATE INDEX IF NOT EXISTS "idx_awareness_events_received_event" ON "awareness_events" ("receivedAt", "eventId")`,
        );
        await queryRunner.query(
            `CREATE INDEX IF NOT EXISTS "idx_awareness_events_envelope_version" ON "awareness_events" ("packetId", "streamVersion")`,
        );
        await queryRunner.query(
            `CREATE INDEX IF NOT EXISTS "idx_awareness_events_ontology_received" ON "awareness_events" ("ontology", "receivedAt")`,
        );
        await queryRunner.query(
            `CREATE INDEX IF NOT EXISTS "idx_awareness_events_packet" ON "awareness_events" ("packetId")`,
        );
        await queryRunner.query(`
            INSERT INTO "awareness_events" (
                "eventId", "packetId", "ontology", "evaultPublicKey", "w3id",
                "data", "operation", "occurredAt", "receivedAt"
            )
            SELECT
                'legacy-packet:' || p.id,
                p.id, p.ontology, p."evaultPublicKey", p.w3id,
                p.data, p.operation, p."receivedAt", p."receivedAt"
            FROM packets p
            ON CONFLICT ("eventId") DO NOTHING
        `);

        await queryRunner.query(
            `ALTER TABLE "deliveries" ADD COLUMN IF NOT EXISTS "eventId" varchar`,
        );
        // A legacy delivery snapshot is the best recoverable representation of
        // the pre-event-id history. The delivery id makes every row distinct;
        // new producers supply stable ids and are deduplicated correctly.
        await queryRunner.query(
            `UPDATE "deliveries" SET "eventId" = 'legacy:' || "id"::text WHERE "eventId" IS NULL`,
        );
        await queryRunner.query(
            `ALTER TABLE "deliveries" ALTER COLUMN "eventId" SET NOT NULL`,
        );
        await queryRunner.query(
            `ALTER TABLE "deliveries" ADD COLUMN IF NOT EXISTS "leaseOwner" varchar`,
        );
        await queryRunner.query(
            `ALTER TABLE "deliveries" ADD COLUMN IF NOT EXISTS "leaseToken" uuid`,
        );
        await queryRunner.query(
            `ALTER TABLE "deliveries" ADD COLUMN IF NOT EXISTS "leaseExpiresAt" timestamptz`,
        );
        // Rows claimed by the old in-process latch have no lease and would be
        // unrecoverable under lease semantics unless explicitly released.
        await queryRunner.query(`
            UPDATE "deliveries"
            SET status = 'failed',
                "nextAttemptAt" = now(),
                "lastError" = coalesce("lastError", 'released by lease migration')
            WHERE status = 'delivering' AND "leaseExpiresAt" IS NULL
        `);
        await queryRunner.query(
            `ALTER TABLE "deliveries" ADD COLUMN IF NOT EXISTS "retryStartedAt" timestamptz`,
        );
        await queryRunner.query(
            `UPDATE "deliveries" SET "retryStartedAt" = "createdAt" WHERE "retryStartedAt" IS NULL`,
        );
        await queryRunner.query(
            `ALTER TABLE "deliveries" ALTER COLUMN "retryStartedAt" SET DEFAULT now()`,
        );
        await queryRunner.query(
            `ALTER TABLE "deliveries" ALTER COLUMN "retryStartedAt" SET NOT NULL`,
        );
        await queryRunner.query(
            `ALTER TABLE "deliveries" DROP CONSTRAINT IF EXISTS "uq_delivery_subscription_packet_content"`,
        );
        await queryRunner.query(
            `CREATE UNIQUE INDEX IF NOT EXISTS "uq_delivery_subscription_event" ON "deliveries" ("subscriptionId", "eventId")`,
        );
        await queryRunner.query(
            `CREATE INDEX IF NOT EXISTS "idx_deliveries_event" ON "deliveries" ("eventId")`,
        );
        await queryRunner.query(
            `CREATE INDEX IF NOT EXISTS "idx_deliveries_lease_expires" ON "deliveries" ("leaseExpiresAt")`,
        );
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "idx_deliveries_active_stream_order"
            ON "deliveries" ("subscriptionId", "packetId", "createdAt", "id")
            WHERE status IN ('pending', 'failed', 'delivering')
        `);
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "idx_deliveries_claim_due"
            ON "deliveries" ("nextAttemptAt", "createdAt", "id")
            WHERE status IN ('pending', 'failed')
        `);

        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "worker_heartbeats" (
                "workerId" varchar NOT NULL,
                "heartbeatAt" timestamptz NOT NULL,
                "tickStartedAt" timestamptz,
                "lastCompletedAt" timestamptz,
                "lastError" text,
                CONSTRAINT "PK_worker_heartbeats" PRIMARY KEY ("workerId")
            )
        `);

        // Guarantee that repeated failure handling creates only one dead letter.
        await queryRunner.query(`
            DELETE FROM "dead_letters" a
            USING "dead_letters" b
            WHERE a."deliveryId" = b."deliveryId"
              AND (
                a."createdAt" > b."createdAt"
                OR (a."createdAt" = b."createdAt" AND a.id > b.id)
              )
        `);
        await queryRunner.query(
            `CREATE UNIQUE INDEX IF NOT EXISTS "uq_dead_letters_delivery" ON "dead_letters" ("deliveryId")`,
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `DROP INDEX IF EXISTS "uq_dead_letters_delivery"`,
        );
        await queryRunner.query(`DROP TABLE IF EXISTS "worker_heartbeats"`);
        await queryRunner.query(
            `DROP INDEX IF EXISTS "idx_deliveries_lease_expires"`,
        );
        await queryRunner.query(
            `DROP INDEX IF EXISTS "idx_deliveries_active_stream_order"`,
        );
        await queryRunner.query(
            `DROP INDEX IF EXISTS "idx_deliveries_claim_due"`,
        );
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_deliveries_event"`);
        await queryRunner.query(
            `DROP INDEX IF EXISTS "uq_delivery_subscription_event"`,
        );
        await queryRunner.query(
            `ALTER TABLE "deliveries" DROP COLUMN IF EXISTS "leaseExpiresAt"`,
        );
        await queryRunner.query(
            `ALTER TABLE "deliveries" DROP COLUMN IF EXISTS "leaseToken"`,
        );
        await queryRunner.query(
            `ALTER TABLE "deliveries" DROP COLUMN IF EXISTS "leaseOwner"`,
        );
        await queryRunner.query(
            `ALTER TABLE "deliveries" DROP COLUMN IF EXISTS "retryStartedAt"`,
        );
        await queryRunner.query(
            `ALTER TABLE "deliveries" DROP COLUMN IF EXISTS "eventId"`,
        );
        await queryRunner.query(
            `ALTER TABLE "deliveries" ADD CONSTRAINT "uq_delivery_subscription_packet_content" UNIQUE ("subscriptionId", "packetId", "contentHash")`,
        );
        await queryRunner.query(`DROP TABLE IF EXISTS "awareness_events"`);
    }
}
