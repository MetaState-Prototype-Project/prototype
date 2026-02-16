import { MigrationInterface, QueryRunner } from "typeorm";

export class Migration1760427215447 implements MigrationInterface {
    name = 'Migration1760427215447'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "webhook_processing" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "webhookId" character varying(255) NOT NULL, "globalId" character varying(255) NOT NULL, "schemaId" character varying(255) NOT NULL, "tableName" character varying(100) NOT NULL, "status" character varying(50) NOT NULL DEFAULT 'pending', "errorMessage" text, "localId" uuid, "webhookData" jsonb, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "completedAt" TIMESTAMP, CONSTRAINT "PK_e26b24f9cb5a4851b5a6e4e0bce" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_4d20ac28604facac0ebc7163b0" ON "webhook_processing" ("webhookId") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_4d20ac28604facac0ebc7163b0"`);
        await queryRunner.query(`DROP TABLE "webhook_processing"`);
    }

}
