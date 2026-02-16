import { MigrationInterface, QueryRunner } from "typeorm";

export class Migration1765784749012 implements MigrationInterface {
    name = 'Migration1765784749012'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "currencies" ADD "maxNegativeBalance" numeric(18,2)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "currencies" DROP COLUMN "maxNegativeBalance"`);
    }

}
