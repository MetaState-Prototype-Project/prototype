import { MigrationInterface, QueryRunner } from "typeorm";

export class Migration1765039149572 implements MigrationInterface {
    name = 'Migration1765039149572'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "currencies" ADD "description" character varying`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "currencies" DROP COLUMN "description"`);
    }

}
