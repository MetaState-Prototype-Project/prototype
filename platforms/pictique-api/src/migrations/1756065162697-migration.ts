import { MigrationInterface, QueryRunner } from "typeorm";

export class Migration1756065162697 implements MigrationInterface {
    name = 'Migration1756065162697'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "chat" ADD "ename" character varying`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "chat" DROP COLUMN "ename"`);
    }

}
