import { MigrationInterface, QueryRunner } from "typeorm";

export class Migration1767526081599 implements MigrationInterface {
    name = 'Migration1767526081599'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "user_evault_mappings" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "localUserId" character varying NOT NULL, "evaultW3id" character varying NOT NULL, "evaultUri" character varying NOT NULL, "userProfileId" character varying, "userProfileData" jsonb, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_744ddb4ddca6af2de54773e9213" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "group" ADD "originalMatchParticipants" json`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "group" DROP COLUMN "originalMatchParticipants"`);
        await queryRunner.query(`DROP TABLE "user_evault_mappings"`);
    }

}
