import { MigrationInterface, QueryRunner } from "typeorm";

export class Migration1748966722767 implements MigrationInterface {
    name = 'Migration1748966722767'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "verification" ADD "documentId" character varying`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "verification" DROP COLUMN "documentId"`);
    }

}
