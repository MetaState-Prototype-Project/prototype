import { MigrationInterface, QueryRunner } from "typeorm";

export class Addurl1773657041144 implements MigrationInterface {
    name = 'Addurl1773657041144'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "files" ADD "url" text`);
        await queryRunner.query(`ALTER TABLE "files" ALTER COLUMN "data" DROP NOT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "files" ALTER COLUMN "data" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "files" DROP COLUMN "url"`);
    }

}
