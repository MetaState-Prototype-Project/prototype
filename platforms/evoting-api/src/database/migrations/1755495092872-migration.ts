import { MigrationInterface, QueryRunner } from "typeorm";

export class Migration1755495092872 implements MigrationInterface {
    name = 'Migration1755495092872'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "messages" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "text" text NOT NULL, "isSystemMessage" boolean NOT NULL DEFAULT false, "voteId" uuid, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "isArchived" boolean NOT NULL DEFAULT false, "senderId" uuid, "groupId" uuid, CONSTRAINT "PK_18325f38ae6de43878487eff986" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "group" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying, "description" character varying, "owner" character varying, "charter" text, "isPrivate" boolean NOT NULL DEFAULT false, "visibility" character varying NOT NULL DEFAULT 'public', "avatarUrl" character varying, "bannerUrl" character varying, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_256aa0fda9b1de1a73ee0b7106b" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "user_followers" ("user_id" uuid NOT NULL, "follower_id" uuid NOT NULL, CONSTRAINT "PK_d7b47e785d7dbc74b2f22f30045" PRIMARY KEY ("user_id", "follower_id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_a59d62cda8101214445e295cdc" ON "user_followers" ("user_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_da722d93356ae3119d6be40d98" ON "user_followers" ("follower_id") `);
        await queryRunner.query(`CREATE TABLE "user_following" ("user_id" uuid NOT NULL, "following_id" uuid NOT NULL, CONSTRAINT "PK_5d7e9a83ee6f9b806d569068a30" PRIMARY KEY ("user_id", "following_id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_a28a2c27629ac06a41720d01c3" ON "user_following" ("user_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_94e1183284db3e697031eb7775" ON "user_following" ("following_id") `);
        await queryRunner.query(`CREATE TABLE "group_members" ("group_id" uuid NOT NULL, "user_id" uuid NOT NULL, CONSTRAINT "PK_f5939ee0ad233ad35e03f5c65c1" PRIMARY KEY ("group_id", "user_id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_2c840df5db52dc6b4a1b0b69c6" ON "group_members" ("group_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_20a555b299f75843aa53ff8b0e" ON "group_members" ("user_id") `);
        await queryRunner.query(`CREATE TABLE "group_admins" ("group_id" uuid NOT NULL, "user_id" uuid NOT NULL, CONSTRAINT "PK_a63ab4ea34529a63cdd55eed88d" PRIMARY KEY ("group_id", "user_id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_0ecd81bfecc31d4f804ece20ef" ON "group_admins" ("group_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_29bb650b1c5b1639dfb089f39a" ON "group_admins" ("user_id") `);
        await queryRunner.query(`CREATE TABLE "group_participants" ("group_id" uuid NOT NULL, "user_id" uuid NOT NULL, CONSTRAINT "PK_92021b85af6470d6b405e12f312" PRIMARY KEY ("group_id", "user_id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_e61f897ae7a7df4b56595adaae" ON "group_participants" ("group_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_bb1d0ab0d82e0a62fa55b7e841" ON "group_participants" ("user_id") `);
        await queryRunner.query(`ALTER TABLE "polls" ADD "deadlineMessageSent" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`ALTER TABLE "polls" ADD "groupId" uuid`);
        await queryRunner.query(`ALTER TABLE "messages" ADD CONSTRAINT "FK_2db9cf2b3ca111742793f6c37ce" FOREIGN KEY ("senderId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "messages" ADD CONSTRAINT "FK_438f09ab5b4bbcd27683eac2a5e" FOREIGN KEY ("groupId") REFERENCES "group"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "user_followers" ADD CONSTRAINT "FK_a59d62cda8101214445e295cdc8" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "user_followers" ADD CONSTRAINT "FK_da722d93356ae3119d6be40d988" FOREIGN KEY ("follower_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "user_following" ADD CONSTRAINT "FK_a28a2c27629ac06a41720d01c30" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "user_following" ADD CONSTRAINT "FK_94e1183284db3e697031eb7775d" FOREIGN KEY ("following_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "group_members" ADD CONSTRAINT "FK_2c840df5db52dc6b4a1b0b69c6e" FOREIGN KEY ("group_id") REFERENCES "group"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "group_members" ADD CONSTRAINT "FK_20a555b299f75843aa53ff8b0ee" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "group_admins" ADD CONSTRAINT "FK_0ecd81bfecc31d4f804ece20efc" FOREIGN KEY ("group_id") REFERENCES "group"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "group_admins" ADD CONSTRAINT "FK_29bb650b1c5b1639dfb089f39a7" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "group_participants" ADD CONSTRAINT "FK_e61f897ae7a7df4b56595adaae7" FOREIGN KEY ("group_id") REFERENCES "group"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "group_participants" ADD CONSTRAINT "FK_bb1d0ab0d82e0a62fa55b7e8411" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "group_participants" DROP CONSTRAINT "FK_bb1d0ab0d82e0a62fa55b7e8411"`);
        await queryRunner.query(`ALTER TABLE "group_participants" DROP CONSTRAINT "FK_e61f897ae7a7df4b56595adaae7"`);
        await queryRunner.query(`ALTER TABLE "group_admins" DROP CONSTRAINT "FK_29bb650b1c5b1639dfb089f39a7"`);
        await queryRunner.query(`ALTER TABLE "group_admins" DROP CONSTRAINT "FK_0ecd81bfecc31d4f804ece20efc"`);
        await queryRunner.query(`ALTER TABLE "group_members" DROP CONSTRAINT "FK_20a555b299f75843aa53ff8b0ee"`);
        await queryRunner.query(`ALTER TABLE "group_members" DROP CONSTRAINT "FK_2c840df5db52dc6b4a1b0b69c6e"`);
        await queryRunner.query(`ALTER TABLE "user_following" DROP CONSTRAINT "FK_94e1183284db3e697031eb7775d"`);
        await queryRunner.query(`ALTER TABLE "user_following" DROP CONSTRAINT "FK_a28a2c27629ac06a41720d01c30"`);
        await queryRunner.query(`ALTER TABLE "user_followers" DROP CONSTRAINT "FK_da722d93356ae3119d6be40d988"`);
        await queryRunner.query(`ALTER TABLE "user_followers" DROP CONSTRAINT "FK_a59d62cda8101214445e295cdc8"`);
        await queryRunner.query(`ALTER TABLE "messages" DROP CONSTRAINT "FK_438f09ab5b4bbcd27683eac2a5e"`);
        await queryRunner.query(`ALTER TABLE "messages" DROP CONSTRAINT "FK_2db9cf2b3ca111742793f6c37ce"`);
        await queryRunner.query(`ALTER TABLE "polls" DROP COLUMN "groupId"`);
        await queryRunner.query(`ALTER TABLE "polls" DROP COLUMN "deadlineMessageSent"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_bb1d0ab0d82e0a62fa55b7e841"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_e61f897ae7a7df4b56595adaae"`);
        await queryRunner.query(`DROP TABLE "group_participants"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_29bb650b1c5b1639dfb089f39a"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_0ecd81bfecc31d4f804ece20ef"`);
        await queryRunner.query(`DROP TABLE "group_admins"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_20a555b299f75843aa53ff8b0e"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_2c840df5db52dc6b4a1b0b69c6"`);
        await queryRunner.query(`DROP TABLE "group_members"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_94e1183284db3e697031eb7775"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_a28a2c27629ac06a41720d01c3"`);
        await queryRunner.query(`DROP TABLE "user_following"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_da722d93356ae3119d6be40d98"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_a59d62cda8101214445e295cdc"`);
        await queryRunner.query(`DROP TABLE "user_followers"`);
        await queryRunner.query(`DROP TABLE "group"`);
        await queryRunner.query(`DROP TABLE "messages"`);
    }

}
