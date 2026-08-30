import type { MigrationInterface, QueryRunner } from "typeorm";

export class PlatformManagement1788090000000 implements MigrationInterface {
    name = "PlatformManagement1788090000000";

    async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "platform_management" (
            "ename" character varying NOT NULL,
            "manager" character varying NOT NULL,
            "profileEnvelopeId" character varying NOT NULL,
            "revokedTokenFingerprint" character varying(64) NOT NULL,
            "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
            "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
            CONSTRAINT "PK_platform_management_ename" PRIMARY KEY ("ename")
        )`);
    }

    async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "platform_management"`);
    }
}
