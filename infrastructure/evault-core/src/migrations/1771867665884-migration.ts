import { MigrationInterface, QueryRunner } from "typeorm";

export class Migration1771867665884 implements MigrationInterface {
    name = 'Migration1771867665884'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "verification" ADD "diditSessionId" character varying`);
        await queryRunner.query(`ALTER TABLE "verification" ADD "verificationUrl" character varying`);
        await queryRunner.query(`ALTER TABLE "verification" ADD "sessionToken" character varying`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "verification" DROP COLUMN "sessionToken"`);
        await queryRunner.query(`ALTER TABLE "verification" DROP COLUMN "verificationUrl"`);
        await queryRunner.query(`ALTER TABLE "verification" DROP COLUMN "diditSessionId"`);
    }

}
