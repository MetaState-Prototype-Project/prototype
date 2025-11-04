import { MigrationInterface, QueryRunner } from "typeorm";

export class Migration1758389959600 implements MigrationInterface {
    name = 'Migration1758389959600'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "verification" ADD "linkedEName" character varying`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "verification" DROP COLUMN "linkedEName"`);
    }

}
