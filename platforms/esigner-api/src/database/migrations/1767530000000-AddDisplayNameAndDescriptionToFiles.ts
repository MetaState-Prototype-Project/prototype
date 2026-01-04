import { MigrationInterface, QueryRunner } from "typeorm";

export class AddDisplayNameAndDescriptionToFiles1767530000000 implements MigrationInterface {
    name = 'AddDisplayNameAndDescriptionToFiles1767530000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "files" ADD "displayName" character varying`);
        await queryRunner.query(`ALTER TABLE "files" ADD "description" text`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "files" DROP COLUMN "description"`);
        await queryRunner.query(`ALTER TABLE "files" DROP COLUMN "displayName"`);
    }
}

