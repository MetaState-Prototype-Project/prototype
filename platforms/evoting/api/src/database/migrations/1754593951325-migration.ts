import { MigrationInterface, QueryRunner } from "typeorm";

export class Migration1754593951325 implements MigrationInterface {
    name = 'Migration1754593951325'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "votes" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "pollId" uuid NOT NULL, "userId" uuid NOT NULL, "voterId" character varying(255) NOT NULL, "data" jsonb NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_f3d9fd4a0af865152c3f59db8ff" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."polls_mode_enum" AS ENUM('normal', 'point', 'rank')`);
        await queryRunner.query(`CREATE TYPE "public"."polls_visibility_enum" AS ENUM('public', 'private')`);
        await queryRunner.query(`CREATE TABLE "polls" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "title" character varying(255) NOT NULL, "mode" "public"."polls_mode_enum" NOT NULL DEFAULT 'normal', "visibility" "public"."polls_visibility_enum" NOT NULL DEFAULT 'public', "options" text NOT NULL, "deadline" TIMESTAMP, "creatorId" uuid NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_b9bbb8fc7b142553c518ddffbb6" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "handle" character varying, "name" character varying, "description" character varying, "avatarUrl" character varying, "bannerUrl" character varying, "ename" character varying, "isVerified" boolean NOT NULL DEFAULT false, "isPrivate" boolean NOT NULL DEFAULT false, "email" character varying(255), "emailVerified" boolean NOT NULL DEFAULT false, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "isArchived" boolean NOT NULL DEFAULT false, CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "verification" ("id" character varying(36) NOT NULL, "identifier" text NOT NULL, "value" text NOT NULL, "expiresAt" TIMESTAMP NOT NULL, "createdAt" TIMESTAMP, "updatedAt" TIMESTAMP, CONSTRAINT "PK_f7e3a90ca384e71d6e2e93bb340" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "meta_envelope_maps" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "localId" character varying(255) NOT NULL, "globalId" character varying(255) NOT NULL, "entityType" character varying(255) NOT NULL, "platform" character varying(255) NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_65f4ea0e777c7c0edbcfac5a1d8" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "votes" ADD CONSTRAINT "FK_2e40638d2d3b898da1af363837c" FOREIGN KEY ("pollId") REFERENCES "polls"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "votes" ADD CONSTRAINT "FK_5169384e31d0989699a318f3ca4" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "polls" ADD CONSTRAINT "FK_57e3240e3361bf5e1400ba0191d" FOREIGN KEY ("creatorId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "polls" DROP CONSTRAINT "FK_57e3240e3361bf5e1400ba0191d"`);
        await queryRunner.query(`ALTER TABLE "votes" DROP CONSTRAINT "FK_5169384e31d0989699a318f3ca4"`);
        await queryRunner.query(`ALTER TABLE "votes" DROP CONSTRAINT "FK_2e40638d2d3b898da1af363837c"`);
        await queryRunner.query(`DROP TABLE "meta_envelope_maps"`);
        await queryRunner.query(`DROP TABLE "verification"`);
        await queryRunner.query(`DROP TABLE "users"`);
        await queryRunner.query(`DROP TABLE "polls"`);
        await queryRunner.query(`DROP TYPE "public"."polls_visibility_enum"`);
        await queryRunner.query(`DROP TYPE "public"."polls_mode_enum"`);
        await queryRunner.query(`DROP TABLE "votes"`);
    }

}
