import { MigrationInterface, QueryRunner } from "typeorm";

/** Preserve the exact event body on each queued delivery. */
export class AddDeliveryPayload1780404367749 implements MigrationInterface {
    name = "AddDeliveryPayload1780404367749";

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TABLE "deliveries" ADD "payload" jsonb`,
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TABLE "deliveries" DROP COLUMN "payload"`,
        );
    }
}
