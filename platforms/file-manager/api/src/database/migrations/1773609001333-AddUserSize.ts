import { MigrationInterface, QueryRunner } from "typeorm";

export class AddUserSize1773609001333 implements MigrationInterface {
    name = 'AddUserSize1773609001333'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" ADD "size" integer NOT NULL DEFAULT 1`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "size"`);
    }

}
