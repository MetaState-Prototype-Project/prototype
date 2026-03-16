import { MigrationInterface, QueryRunner } from "typeorm";

export class ProfessionalProfiles1773665365495 implements MigrationInterface {
    name = 'ProfessionalProfiles1773665365495'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "professional_profiles" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "ename" character varying NOT NULL, "displayName" character varying, "headline" character varying, "bio" text, "avatarFileId" character varying, "bannerFileId" character varying, "cvFileId" character varying, "videoIntroFileId" character varying, "location" character varying, "skills" text array, "workExperience" jsonb, "education" jsonb, "isPublic" boolean NOT NULL DEFAULT true, "socialLinks" jsonb, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_bfb533ecd1e10f08359f04cf0e2" UNIQUE ("ename"), CONSTRAINT "PK_b2140d2f56b0910e4c58ab4d2a2" PRIMARY KEY ("id"))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "professional_profiles"`);
    }

}
