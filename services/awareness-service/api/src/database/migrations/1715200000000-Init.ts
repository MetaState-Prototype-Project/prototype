import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Initial schema for Awareness as a Service: awareness packets, consumers and
 * their access applications, API keys, webhook subscriptions, the delivery
 * queue and the dead-letter table.
 */
export class Init1715200000000 implements MigrationInterface {
    name = "Init1715200000000";

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE "packets" (
                "id" varchar NOT NULL,
                "ontology" varchar NOT NULL,
                "evaultPublicKey" varchar,
                "w3id" varchar,
                "data" jsonb,
                "operation" varchar NOT NULL DEFAULT 'create',
                "receivedAt" timestamptz NOT NULL DEFAULT now(),
                "createdAt" timestamptz NOT NULL DEFAULT now(),
                CONSTRAINT "PK_packets" PRIMARY KEY ("id")
            )
        `);
        await queryRunner.query(
            `CREATE INDEX "idx_packets_ontology" ON "packets" ("ontology")`,
        );
        await queryRunner.query(
            `CREATE INDEX "idx_packets_evault_pubkey" ON "packets" ("evaultPublicKey")`,
        );
        await queryRunner.query(
            `CREATE INDEX "idx_packets_w3id" ON "packets" ("w3id")`,
        );
        await queryRunner.query(
            `CREATE INDEX "idx_packets_received" ON "packets" ("receivedAt")`,
        );
        await queryRunner.query(
            `CREATE INDEX "idx_packets_ontology_received" ON "packets" ("ontology", "receivedAt")`,
        );
        await queryRunner.query(
            `CREATE INDEX "idx_packets_received_id" ON "packets" ("receivedAt", "id")`,
        );

        await queryRunner.query(`
            CREATE TABLE "consumers" (
                "id" uuid NOT NULL DEFAULT gen_random_uuid(),
                "ename" varchar NOT NULL,
                "name" varchar,
                "contactEmail" varchar,
                "status" varchar NOT NULL DEFAULT 'pending',
                "webhookBaseUrl" varchar,
                "createdAt" timestamptz NOT NULL DEFAULT now(),
                "approvedAt" timestamptz,
                CONSTRAINT "PK_consumers" PRIMARY KEY ("id")
            )
        `);
        await queryRunner.query(
            `CREATE UNIQUE INDEX "idx_consumers_ename" ON "consumers" ("ename")`,
        );

        await queryRunner.query(`
            CREATE TABLE "access_applications" (
                "id" uuid NOT NULL DEFAULT gen_random_uuid(),
                "consumerId" uuid NOT NULL,
                "justification" text,
                "requestedOntologies" text array NOT NULL DEFAULT '{}',
                "status" varchar NOT NULL DEFAULT 'pending',
                "reviewedByEname" varchar,
                "reviewNote" text,
                "createdAt" timestamptz NOT NULL DEFAULT now(),
                "reviewedAt" timestamptz,
                CONSTRAINT "PK_access_applications" PRIMARY KEY ("id")
            )
        `);
        await queryRunner.query(
            `CREATE INDEX "idx_applications_consumer" ON "access_applications" ("consumerId")`,
        );

        await queryRunner.query(`
            CREATE TABLE "api_keys" (
                "id" uuid NOT NULL DEFAULT gen_random_uuid(),
                "consumerId" uuid NOT NULL,
                "keyHash" varchar NOT NULL,
                "keyPrefix" varchar NOT NULL,
                "revoked" boolean NOT NULL DEFAULT false,
                "createdAt" timestamptz NOT NULL DEFAULT now(),
                "lastUsedAt" timestamptz,
                CONSTRAINT "PK_api_keys" PRIMARY KEY ("id")
            )
        `);
        await queryRunner.query(
            `CREATE INDEX "idx_api_keys_consumer" ON "api_keys" ("consumerId")`,
        );
        await queryRunner.query(
            `CREATE UNIQUE INDEX "idx_api_keys_hash" ON "api_keys" ("keyHash")`,
        );

        await queryRunner.query(`
            CREATE TABLE "subscriptions" (
                "id" uuid NOT NULL DEFAULT gen_random_uuid(),
                "consumerId" uuid NOT NULL,
                "targetUrl" varchar NOT NULL,
                "ontologyFilter" text array NOT NULL DEFAULT '{}',
                "evaultFilter" text array NOT NULL DEFAULT '{}',
                "isCatchAll" boolean NOT NULL DEFAULT false,
                "active" boolean NOT NULL DEFAULT true,
                "secret" varchar,
                "createdAt" timestamptz NOT NULL DEFAULT now(),
                CONSTRAINT "PK_subscriptions" PRIMARY KEY ("id")
            )
        `);
        await queryRunner.query(
            `CREATE INDEX "idx_subscriptions_consumer" ON "subscriptions" ("consumerId")`,
        );

        await queryRunner.query(`
            CREATE TABLE "deliveries" (
                "id" uuid NOT NULL DEFAULT gen_random_uuid(),
                "subscriptionId" uuid NOT NULL,
                "packetId" varchar NOT NULL,
                "status" varchar NOT NULL DEFAULT 'pending',
                "attempts" integer NOT NULL DEFAULT 0,
                "nextAttemptAt" timestamptz NOT NULL DEFAULT now(),
                "lastError" text,
                "lastResponseStatus" integer,
                "createdAt" timestamptz NOT NULL DEFAULT now(),
                "deliveredAt" timestamptz,
                CONSTRAINT "PK_deliveries" PRIMARY KEY ("id"),
                CONSTRAINT "uq_delivery_subscription_packet" UNIQUE ("subscriptionId", "packetId")
            )
        `);
        await queryRunner.query(
            `CREATE INDEX "idx_deliveries_subscription" ON "deliveries" ("subscriptionId")`,
        );
        await queryRunner.query(
            `CREATE INDEX "idx_deliveries_next_attempt" ON "deliveries" ("nextAttemptAt")`,
        );

        await queryRunner.query(`
            CREATE TABLE "dead_letters" (
                "id" uuid NOT NULL DEFAULT gen_random_uuid(),
                "deliveryId" uuid NOT NULL,
                "subscriptionId" uuid NOT NULL,
                "packetId" varchar NOT NULL,
                "consumerId" uuid NOT NULL,
                "payload" jsonb NOT NULL,
                "targetUrl" varchar NOT NULL,
                "totalAttempts" integer NOT NULL,
                "lastError" text,
                "lastResponseStatus" integer,
                "resolved" boolean NOT NULL DEFAULT false,
                "createdAt" timestamptz NOT NULL DEFAULT now(),
                CONSTRAINT "PK_dead_letters" PRIMARY KEY ("id")
            )
        `);
        await queryRunner.query(
            `CREATE INDEX "idx_dead_letters_resolved" ON "dead_letters" ("resolved")`,
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "dead_letters"`);
        await queryRunner.query(`DROP TABLE "deliveries"`);
        await queryRunner.query(`DROP TABLE "subscriptions"`);
        await queryRunner.query(`DROP TABLE "api_keys"`);
        await queryRunner.query(`DROP TABLE "access_applications"`);
        await queryRunner.query(`DROP TABLE "consumers"`);
        await queryRunner.query(`DROP TABLE "packets"`);
    }
}
