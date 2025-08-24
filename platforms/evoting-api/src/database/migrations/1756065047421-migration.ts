import { MigrationInterface, QueryRunner } from "typeorm";

export class Migration1756065047421 implements MigrationInterface {
    name = 'Migration1756065047421'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "group" ADD "ename" character varying`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "group" DROP COLUMN "ename"`);
    }

}
