import { MigrationInterface, QueryRunner } from "typeorm";

export class Migration1765044585971 implements MigrationInterface {
    name = 'Migration1765044585971'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "ledger" ADD "senderAccountId" character varying`);
        await queryRunner.query(`CREATE TYPE "public"."ledger_senderaccounttype_enum" AS ENUM('user', 'group')`);
        await queryRunner.query(`ALTER TABLE "ledger" ADD "senderAccountType" "public"."ledger_senderaccounttype_enum"`);
        await queryRunner.query(`ALTER TABLE "ledger" ADD "receiverAccountId" character varying`);
        await queryRunner.query(`CREATE TYPE "public"."ledger_receiveraccounttype_enum" AS ENUM('user', 'group')`);
        await queryRunner.query(`ALTER TABLE "ledger" ADD "receiverAccountType" "public"."ledger_receiveraccounttype_enum"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "ledger" DROP COLUMN "receiverAccountType"`);
        await queryRunner.query(`DROP TYPE "public"."ledger_receiveraccounttype_enum"`);
        await queryRunner.query(`ALTER TABLE "ledger" DROP COLUMN "receiverAccountId"`);
        await queryRunner.query(`ALTER TABLE "ledger" DROP COLUMN "senderAccountType"`);
        await queryRunner.query(`DROP TYPE "public"."ledger_senderaccounttype_enum"`);
        await queryRunner.query(`ALTER TABLE "ledger" DROP COLUMN "senderAccountId"`);
    }

}
