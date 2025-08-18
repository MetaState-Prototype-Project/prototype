import { MigrationInterface, QueryRunner } from "typeorm";

export class Migration1755282900142 implements MigrationInterface {
    name = 'Migration1755282900142'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "messages" ADD "isSystemMessage" boolean NOT NULL DEFAULT false`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "messages" DROP COLUMN "isSystemMessage"`);
    }

}
