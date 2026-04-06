import { MigrationInterface, QueryRunner } from "typeorm";

export class AddCustomPrompt1775035663491 implements MigrationInterface {
    name = 'AddCustomPrompt1775035663491'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "polls" ADD "customPrompt" text`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "polls" DROP COLUMN "customPrompt"`);
    }
}
