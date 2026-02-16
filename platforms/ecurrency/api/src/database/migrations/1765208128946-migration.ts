import { MigrationInterface, QueryRunner } from "typeorm";

export class Migration1765208128946 implements MigrationInterface {
    name = 'Migration1765208128946'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "messages" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "text" text NOT NULL, "isSystemMessage" boolean NOT NULL DEFAULT false, "voteId" uuid, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "isArchived" boolean NOT NULL DEFAULT false, "senderId" uuid, "groupId" uuid, CONSTRAINT "PK_18325f38ae6de43878487eff986" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "user_evault_mappings" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "localUserId" character varying NOT NULL, "evaultW3id" character varying NOT NULL, "evaultUri" character varying NOT NULL, "userProfileId" character varying, "userProfileData" jsonb, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_744ddb4ddca6af2de54773e9213" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "messages" ADD CONSTRAINT "FK_2db9cf2b3ca111742793f6c37ce" FOREIGN KEY ("senderId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "messages" ADD CONSTRAINT "FK_438f09ab5b4bbcd27683eac2a5e" FOREIGN KEY ("groupId") REFERENCES "group"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "messages" DROP CONSTRAINT "FK_438f09ab5b4bbcd27683eac2a5e"`);
        await queryRunner.query(`ALTER TABLE "messages" DROP CONSTRAINT "FK_2db9cf2b3ca111742793f6c37ce"`);
        await queryRunner.query(`DROP TABLE "user_evault_mappings"`);
        await queryRunner.query(`DROP TABLE "messages"`);
    }

}
