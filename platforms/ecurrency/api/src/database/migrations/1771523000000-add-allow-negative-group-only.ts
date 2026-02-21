import { MigrationInterface, QueryRunner } from "typeorm";

export class AddAllowNegativeGroupOnly1771523000000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "currencies" ADD "allowNegativeGroupOnly" boolean NOT NULL DEFAULT false`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "currencies" DROP COLUMN "allowNegativeGroupOnly"`);
    }
}
