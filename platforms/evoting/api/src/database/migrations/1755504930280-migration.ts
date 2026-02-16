import { MigrationInterface, QueryRunner } from "typeorm";

export class Migration1755504930280 implements MigrationInterface {
    name = "Migration1755504930280";

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TABLE "polls" ADD "deadlineMessageSent" boolean NOT NULL DEFAULT false`,
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TABLE "polls" DROP COLUMN "deadlineMessageSent"`,
        );
    }
}
