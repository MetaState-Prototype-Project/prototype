import { MigrationInterface, QueryRunner } from "typeorm";

export class Migration1763549545131 implements MigrationInterface {
    name = 'Migration1763549545131'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."polls_mode_enum" AS ENUM('normal', 'point', 'rank')`);
        await queryRunner.query(`CREATE TYPE "public"."polls_visibility_enum" AS ENUM('public', 'private')`);
        await queryRunner.query(`CREATE TABLE "polls" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "title" character varying(255) NOT NULL, "mode" "public"."polls_mode_enum" NOT NULL DEFAULT 'normal', "visibility" "public"."polls_visibility_enum" NOT NULL DEFAULT 'public', "options" text NOT NULL, "deadline" TIMESTAMP, "deadlineMessageSent" boolean NOT NULL DEFAULT false, "creatorId" uuid NOT NULL, "groupId" uuid, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_b9bbb8fc7b142553c518ddffbb6" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "votes" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "pollId" uuid NOT NULL, "userId" uuid NOT NULL, "voterId" character varying(255) NOT NULL, "data" jsonb NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_f3d9fd4a0af865152c3f59db8ff" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "polls" ADD CONSTRAINT "FK_57e3240e3361bf5e1400ba0191d" FOREIGN KEY ("creatorId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "votes" ADD CONSTRAINT "FK_2e40638d2d3b898da1af363837c" FOREIGN KEY ("pollId") REFERENCES "polls"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "votes" ADD CONSTRAINT "FK_5169384e31d0989699a318f3ca4" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "votes" DROP CONSTRAINT "FK_5169384e31d0989699a318f3ca4"`);
        await queryRunner.query(`ALTER TABLE "votes" DROP CONSTRAINT "FK_2e40638d2d3b898da1af363837c"`);
        await queryRunner.query(`ALTER TABLE "polls" DROP CONSTRAINT "FK_57e3240e3361bf5e1400ba0191d"`);
        await queryRunner.query(`DROP TABLE "votes"`);
        await queryRunner.query(`DROP TABLE "polls"`);
        await queryRunner.query(`DROP TYPE "public"."polls_visibility_enum"`);
        await queryRunner.query(`DROP TYPE "public"."polls_mode_enum"`);
    }

}
