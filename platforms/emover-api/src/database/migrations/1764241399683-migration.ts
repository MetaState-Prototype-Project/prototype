import { MigrationInterface, QueryRunner } from "typeorm";

export class Migration1764241399683 implements MigrationInterface {
    name = 'Migration1764241399683'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."evault_migrations_status_enum" AS ENUM('initiated', 'provisioning', 'copying', 'verifying', 'updating_registry', 'marking_active', 'completed', 'failed')`);
        await queryRunner.query(`CREATE TABLE "evault_migrations" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid NOT NULL, "oldEvaultId" character varying, "newEvaultId" character varying, "eName" character varying, "oldEvaultUri" character varying, "newEvaultUri" character varying, "provisionerUrl" character varying, "status" "public"."evault_migrations_status_enum" NOT NULL DEFAULT 'initiated', "logs" text, "error" text, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_f32dd99f3ca413e7fbe0dbe418e" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "ename" character varying, "name" character varying, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "users"`);
        await queryRunner.query(`DROP TABLE "evault_migrations"`);
        await queryRunner.query(`DROP TYPE "public"."evault_migrations_status_enum"`);
    }

}
