import { MigrationInterface, QueryRunner } from "typeorm";

export class AddDeadlineMessageSentToPolls1710000000000 implements MigrationInterface {
    name = 'AddDeadlineMessageSentToPolls1710000000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "polls" 
            ADD COLUMN "deadlineMessageSent" boolean NOT NULL DEFAULT false
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "polls" 
            DROP COLUMN "deadlineMessageSent"
        `);
    }
} 