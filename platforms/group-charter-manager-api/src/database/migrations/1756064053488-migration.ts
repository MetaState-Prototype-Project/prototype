import { MigrationInterface, QueryRunner } from "typeorm";

export class Migration1756064053488 implements MigrationInterface {
    name = 'Migration1756064053488'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "group" ADD "ename" character varying`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "group" DROP COLUMN "ename"`);
    }

}
