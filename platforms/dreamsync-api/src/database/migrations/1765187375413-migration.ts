import { MigrationInterface, QueryRunner } from "typeorm";

export class Migration1765187375413 implements MigrationInterface {
    name = 'Migration1765187375413'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "wishlists" ADD "summaryWants" text`);
        await queryRunner.query(`ALTER TABLE "wishlists" ADD "summaryOffers" text`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "wishlists" DROP COLUMN "summaryOffers"`);
        await queryRunner.query(`ALTER TABLE "wishlists" DROP COLUMN "summaryWants"`);
    }

}
