import { MigrationInterface, QueryRunner } from "typeorm";

export class Migration1754063849121 implements MigrationInterface {
    name = 'Migration1754063849121'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "group" ADD "charter" text`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "group" DROP COLUMN "charter"`);
    }

}
