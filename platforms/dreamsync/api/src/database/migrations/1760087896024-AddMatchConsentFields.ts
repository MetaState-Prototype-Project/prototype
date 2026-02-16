import { MigrationInterface, QueryRunner } from "typeorm";

export class AddMatchConsentFields1760087896024 implements MigrationInterface {
    name = 'AddMatchConsentFields1760087896024'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "matches" ADD "isActive" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`ALTER TABLE "matches" ADD "userAConsent" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`ALTER TABLE "matches" ADD "userBConsent" boolean NOT NULL DEFAULT false`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "matches" DROP COLUMN "userBConsent"`);
        await queryRunner.query(`ALTER TABLE "matches" DROP COLUMN "userAConsent"`);
        await queryRunner.query(`ALTER TABLE "matches" DROP COLUMN "isActive"`);
    }

}
