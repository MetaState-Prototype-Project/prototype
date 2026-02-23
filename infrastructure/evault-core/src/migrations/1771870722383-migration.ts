import { MigrationInterface, QueryRunner } from "typeorm";

export class Migration1771870722383 implements MigrationInterface {
    name = 'Migration1771870722383'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "verification" DROP COLUMN "veriffId"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "verification" ADD "veriffId" character varying`);
    }

}
