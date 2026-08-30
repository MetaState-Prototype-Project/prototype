import type { MigrationInterface, QueryRunner } from "typeorm";

export class SoftwareVersion1788080000000 implements MigrationInterface {
    name = "SoftwareVersion1788080000000";

    async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "software_version" ("id" SERIAL NOT NULL, "ename" character varying NOT NULL, "platformEname" character varying NOT NULL, "version" character varying NOT NULL, "releaseTag" character varying NOT NULL, "commitSha" character varying NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_software_version_ename" UNIQUE ("ename"), CONSTRAINT "UQ_software_version_platform_version" UNIQUE ("platformEname", "version"), CONSTRAINT "PK_software_version" PRIMARY KEY ("id"))`);
    }

    async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "software_version"`);
    }
}
