import { MigrationInterface, QueryRunner } from "typeorm";

export class Migration1748968097591 implements MigrationInterface {
    name = 'Migration1748968097591'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "verification" ADD "consumed" boolean NOT NULL DEFAULT false`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "verification" DROP COLUMN "consumed"`);
    }

}
