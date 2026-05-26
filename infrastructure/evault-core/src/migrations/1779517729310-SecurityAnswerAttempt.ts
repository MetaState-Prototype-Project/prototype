import { MigrationInterface, QueryRunner } from "typeorm";

export class SecurityAnswerAttempt1779517729310 implements MigrationInterface {
    name = 'SecurityAnswerAttempt1779517729310'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."UQ_device_token_ename"`);
        await queryRunner.query(`CREATE TABLE "security_answer_attempt" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "eName" character varying NOT NULL, "failedCount" integer NOT NULL DEFAULT '0', "lockedUntil" TIMESTAMP, "lastAttemptAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_216170eabe6bbbc36d97f20c7f9" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_372fc1eef6d4fcc2f181b15fbc" ON "security_answer_attempt" ("eName") `);
        await queryRunner.query(`ALTER TABLE "notifications" DROP COLUMN "body"`);
        await queryRunner.query(`ALTER TABLE "notifications" ADD "body" text NOT NULL`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_6c2242ce617f6bff7b5dfab565" ON "device_token" ("eName") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_6c2242ce617f6bff7b5dfab565"`);
        await queryRunner.query(`ALTER TABLE "notifications" DROP COLUMN "body"`);
        await queryRunner.query(`ALTER TABLE "notifications" ADD "body" character varying NOT NULL`);
        await queryRunner.query(`DROP INDEX "public"."IDX_372fc1eef6d4fcc2f181b15fbc"`);
        await queryRunner.query(`DROP TABLE "security_answer_attempt"`);
        await queryRunner.query(`CREATE UNIQUE INDEX "UQ_device_token_ename" ON "device_token" ("eName") `);
    }

}
