import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Dedupe deliveries by payload content, not packet id alone. Adds a
 * `contentHash` column to `deliveries` and swaps the unique key from
 * (subscriptionId, packetId) to (subscriptionId, packetId, contentHash) so that
 * re-ingesting an updated MetaEnvelope queues a fresh delivery instead of being
 * silently dropped by the old constraint.
 */
export class AddDeliveryContentHash1780404367748 implements MigrationInterface {
    name = "AddDeliveryContentHash1780404367748";

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Add nullable first, then backfill: a straight `ADD ... NOT NULL`
        // fails on any table that already has delivery rows.
        await queryRunner.query(
            `ALTER TABLE "deliveries" ADD "contentHash" character varying`,
        );
        // Backfill legacy rows with a single constant. This preserves the old
        // one-delivery-per-(subscription, packet) semantics for rows that
        // predate content-based dedup.
        await queryRunner.query(
            `UPDATE "deliveries" SET "contentHash" = '' WHERE "contentHash" IS NULL`,
        );
        await queryRunner.query(
            `ALTER TABLE "deliveries" ALTER COLUMN "contentHash" SET NOT NULL`,
        );
        await queryRunner.query(
            `ALTER TABLE "deliveries" DROP CONSTRAINT "uq_delivery_subscription_packet"`,
        );
        await queryRunner.query(
            `ALTER TABLE "deliveries" ADD CONSTRAINT "uq_delivery_subscription_packet_content" UNIQUE ("subscriptionId", "packetId", "contentHash")`,
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TABLE "deliveries" DROP CONSTRAINT "uq_delivery_subscription_packet_content"`,
        );
        await queryRunner.query(
            `ALTER TABLE "deliveries" DROP COLUMN "contentHash"`,
        );
        await queryRunner.query(
            `ALTER TABLE "deliveries" ADD CONSTRAINT "uq_delivery_subscription_packet" UNIQUE ("subscriptionId", "packetId")`,
        );
    }
}
