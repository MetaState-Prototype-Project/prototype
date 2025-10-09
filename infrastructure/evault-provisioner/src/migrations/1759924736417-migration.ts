import { MigrationInterface, QueryRunner } from "typeorm";

export class Migration1759924736417 implements MigrationInterface {
    name = 'Migration1759924736417'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "verification" ADD "deviceId" character varying`);
        await queryRunner.query(`ALTER TABLE "verification" ADD "platform" character varying`);
        await queryRunner.query(`ALTER TABLE "verification" ADD "fcmToken" character varying`);
        await queryRunner.query(`ALTER TABLE "verification" ADD "deviceActive" boolean NOT NULL DEFAULT true`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "verification" DROP COLUMN "deviceActive"`);
        await queryRunner.query(`ALTER TABLE "verification" DROP COLUMN "fcmToken"`);
        await queryRunner.query(`ALTER TABLE "verification" DROP COLUMN "platform"`);
        await queryRunner.query(`ALTER TABLE "verification" DROP COLUMN "deviceId"`);
    }

}
