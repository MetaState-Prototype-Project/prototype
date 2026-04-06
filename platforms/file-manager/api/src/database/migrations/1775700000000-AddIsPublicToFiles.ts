import { MigrationInterface, QueryRunner } from "typeorm";

export class AddIsPublicToFiles1775700000000 implements MigrationInterface {
    name = 'AddIsPublicToFiles1775700000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "files" ADD "isPublic" boolean NOT NULL DEFAULT false`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "files" DROP COLUMN "isPublic"`);
    }
}
