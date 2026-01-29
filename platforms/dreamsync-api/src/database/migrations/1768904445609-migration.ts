import { MigrationInterface, QueryRunner } from "typeorm";

export class Migration1768904445609 implements MigrationInterface {
    name = 'Migration1768904445609'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "wishlists" DROP COLUMN "summaryWants"`);
        await queryRunner.query(`ALTER TABLE "wishlists" ADD "summaryWants" jsonb`);
        await queryRunner.query(`ALTER TABLE "wishlists" DROP COLUMN "summaryOffers"`);
        await queryRunner.query(`ALTER TABLE "wishlists" ADD "summaryOffers" jsonb`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "wishlists" DROP COLUMN "summaryOffers"`);
        await queryRunner.query(`ALTER TABLE "wishlists" ADD "summaryOffers" text`);
        await queryRunner.query(`ALTER TABLE "wishlists" DROP COLUMN "summaryWants"`);
        await queryRunner.query(`ALTER TABLE "wishlists" ADD "summaryWants" text`);
    }

}
