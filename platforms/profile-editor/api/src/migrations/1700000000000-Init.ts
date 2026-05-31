import type { MigrationInterface, QueryRunner } from "typeorm";

export class Init1700000000000 implements MigrationInterface {
    name = "Init1700000000000";

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

        await queryRunner.query(`
			CREATE TABLE "users" (
				"id" uuid NOT NULL DEFAULT uuid_generate_v4(),
				"ename" character varying,
				"handle" character varying,
				"name" character varying,
				"bio" text,
				"avatarUrl" character varying,
				"bannerUrl" character varying,
				"location" character varying,
				"isVerified" boolean NOT NULL DEFAULT false,
				"isPrivate" boolean NOT NULL DEFAULT false,
				"isArchived" boolean NOT NULL DEFAULT false,
				"createdAt" TIMESTAMP NOT NULL DEFAULT now(),
				"updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
				CONSTRAINT "UQ_users_ename" UNIQUE ("ename"),
				CONSTRAINT "PK_users_id" PRIMARY KEY ("id")
			)
		`);

        await queryRunner.query(`
			CREATE TABLE "professional_profiles" (
				"id" uuid NOT NULL DEFAULT uuid_generate_v4(),
				"ename" character varying,
				"name" character varying,
				"headline" character varying,
				"bio" text,
				"location" character varying,
				"skills" text array,
				"cvFileId" character varying,
				"videoIntroFileId" character varying,
				"isPublic" boolean NOT NULL DEFAULT false,
				"workExperience" jsonb,
				"education" jsonb,
				"socialLinks" jsonb,
				"email" character varying,
				"phone" character varying,
				"website" character varying,
				"createdAt" TIMESTAMP NOT NULL DEFAULT now(),
				"updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
				CONSTRAINT "UQ_professional_profiles_ename" UNIQUE ("ename"),
				CONSTRAINT "PK_professional_profiles_id" PRIMARY KEY ("id")
			)
		`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "professional_profiles"`);
        await queryRunner.query(`DROP TABLE "users"`);
    }
}
