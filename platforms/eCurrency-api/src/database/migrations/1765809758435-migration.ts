import { MigrationInterface, QueryRunner } from "typeorm";

export class Migration1765809758435 implements MigrationInterface {
    name = 'Migration1765809758435'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "ledger" ADD "hash" text`);
        await queryRunner.query(`ALTER TABLE "ledger" ADD "prevHash" text`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "ledger" DROP COLUMN "prevHash"`);
        await queryRunner.query(`ALTER TABLE "ledger" DROP COLUMN "hash"`);
    }

}
