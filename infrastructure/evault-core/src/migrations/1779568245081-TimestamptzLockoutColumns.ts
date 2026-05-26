import { MigrationInterface, QueryRunner } from "typeorm";

export class TimestamptzLockoutColumns1779568245081 implements MigrationInterface {
    name = 'TimestamptzLockoutColumns1779568245081'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "security_answer_attempt" DROP COLUMN "lockedUntil"`);
        await queryRunner.query(`ALTER TABLE "security_answer_attempt" ADD "lockedUntil" TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`ALTER TABLE "security_answer_attempt" DROP COLUMN "lastAttemptAt"`);
        await queryRunner.query(`ALTER TABLE "security_answer_attempt" ADD "lastAttemptAt" TIMESTAMP WITH TIME ZONE`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "security_answer_attempt" DROP COLUMN "lastAttemptAt"`);
        await queryRunner.query(`ALTER TABLE "security_answer_attempt" ADD "lastAttemptAt" TIMESTAMP`);
        await queryRunner.query(`ALTER TABLE "security_answer_attempt" DROP COLUMN "lockedUntil"`);
        await queryRunner.query(`ALTER TABLE "security_answer_attempt" ADD "lockedUntil" TIMESTAMP`);
    }

}
