import { MigrationInterface, QueryRunner } from "typeorm";

export class Migration1749294377768 implements MigrationInterface {
    name = 'Migration1749294377768'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "replies" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "text" text NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "isArchived" boolean NOT NULL DEFAULT false, "creatorId" uuid, "blabId" uuid, CONSTRAINT "PK_08f619ebe431e27e9d206bea132" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "blabs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "content" text NOT NULL, "images" text, "hashtags" text, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "isArchived" boolean NOT NULL DEFAULT false, "authorId" uuid, CONSTRAINT "PK_b0d95cd60d167bef0a53b13a83c" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "message_read_status" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "isRead" boolean NOT NULL DEFAULT false, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "textId" uuid, "userId" uuid, CONSTRAINT "PK_258e8d92b4e212a121dc10a74d3" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "texts" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "content" text NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "isArchived" boolean NOT NULL DEFAULT false, "authorId" uuid, "chatId" uuid, CONSTRAINT "PK_ce044efbc0a1872f20feca7e19f" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "chat" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "chatName" character varying, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_9d0b2ba74336710fd31154738a5" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "username" character varying, "displayName" character varying, "bio" character varying, "profilePictureUrl" character varying, "bannerUrl" character varying, "ename" character varying, "isVerified" boolean NOT NULL DEFAULT false, "isPrivate" boolean NOT NULL DEFAULT false, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "isArchived" boolean NOT NULL DEFAULT false, CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "reply_likes" ("replyt_id" uuid NOT NULL, "user_id" uuid NOT NULL, CONSTRAINT "PK_49ea2d0de64487d96abeb821fc3" PRIMARY KEY ("replyt_id", "user_id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_60cd31853a064c673a3d3324dc" ON "reply_likes" ("replyt_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_ab114098af787728a1d33dd0d2" ON "reply_likes" ("user_id") `);
        await queryRunner.query(`CREATE TABLE "blab_likes" ("blab_id" uuid NOT NULL, "user_id" uuid NOT NULL, CONSTRAINT "PK_71e1e125898ad7b8f98ba53a90e" PRIMARY KEY ("blab_id", "user_id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_8a0152105b2e6a0c279c384dad" ON "blab_likes" ("blab_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_6a02fb4b2afef6af04f030a1c5" ON "blab_likes" ("user_id") `);
        await queryRunner.query(`CREATE TABLE "chat_participants" ("chat_id" uuid NOT NULL, "user_id" uuid NOT NULL, CONSTRAINT "PK_36c99e4a017767179cc49d0ac74" PRIMARY KEY ("chat_id", "user_id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_9946d299e9ccfbee23aa40c554" ON "chat_participants" ("chat_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_b4129b3e21906ca57b503a1d83" ON "chat_participants" ("user_id") `);
        await queryRunner.query(`CREATE TABLE "user_followers" ("user_id" uuid NOT NULL, "follower_id" uuid NOT NULL, CONSTRAINT "PK_d7b47e785d7dbc74b2f22f30045" PRIMARY KEY ("user_id", "follower_id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_a59d62cda8101214445e295cdc" ON "user_followers" ("user_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_da722d93356ae3119d6be40d98" ON "user_followers" ("follower_id") `);
        await queryRunner.query(`CREATE TABLE "user_following" ("user_id" uuid NOT NULL, "following_id" uuid NOT NULL, CONSTRAINT "PK_5d7e9a83ee6f9b806d569068a30" PRIMARY KEY ("user_id", "following_id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_a28a2c27629ac06a41720d01c3" ON "user_following" ("user_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_94e1183284db3e697031eb7775" ON "user_following" ("following_id") `);
        await queryRunner.query(`ALTER TABLE "replies" ADD CONSTRAINT "FK_34408818aba710d6ea7bb40358a" FOREIGN KEY ("creatorId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "replies" ADD CONSTRAINT "FK_3a74da2d3059288882a69be43fa" FOREIGN KEY ("blabId") REFERENCES "blabs"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "blabs" ADD CONSTRAINT "FK_ea5969bad99c59d4f0af17d4692" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "message_read_status" ADD CONSTRAINT "FK_f8aaa4a571e96838b1e15d5ff63" FOREIGN KEY ("textId") REFERENCES "texts"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "message_read_status" ADD CONSTRAINT "FK_00956f27e567b20ea63956a94da" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "texts" ADD CONSTRAINT "FK_16d5fc6d4a731bbd3703793a49c" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "texts" ADD CONSTRAINT "FK_fc650300b13333cbe5ae5fac281" FOREIGN KEY ("chatId") REFERENCES "chat"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "reply_likes" ADD CONSTRAINT "FK_60cd31853a064c673a3d3324dc6" FOREIGN KEY ("replyt_id") REFERENCES "replies"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "reply_likes" ADD CONSTRAINT "FK_ab114098af787728a1d33dd0d25" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "blab_likes" ADD CONSTRAINT "FK_8a0152105b2e6a0c279c384dad3" FOREIGN KEY ("blab_id") REFERENCES "blabs"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "blab_likes" ADD CONSTRAINT "FK_6a02fb4b2afef6af04f030a1c59" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "chat_participants" ADD CONSTRAINT "FK_9946d299e9ccfbee23aa40c5545" FOREIGN KEY ("chat_id") REFERENCES "chat"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "chat_participants" ADD CONSTRAINT "FK_b4129b3e21906ca57b503a1d834" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "user_followers" ADD CONSTRAINT "FK_a59d62cda8101214445e295cdc8" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "user_followers" ADD CONSTRAINT "FK_da722d93356ae3119d6be40d988" FOREIGN KEY ("follower_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "user_following" ADD CONSTRAINT "FK_a28a2c27629ac06a41720d01c30" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "user_following" ADD CONSTRAINT "FK_94e1183284db3e697031eb7775d" FOREIGN KEY ("following_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user_following" DROP CONSTRAINT "FK_94e1183284db3e697031eb7775d"`);
        await queryRunner.query(`ALTER TABLE "user_following" DROP CONSTRAINT "FK_a28a2c27629ac06a41720d01c30"`);
        await queryRunner.query(`ALTER TABLE "user_followers" DROP CONSTRAINT "FK_da722d93356ae3119d6be40d988"`);
        await queryRunner.query(`ALTER TABLE "user_followers" DROP CONSTRAINT "FK_a59d62cda8101214445e295cdc8"`);
        await queryRunner.query(`ALTER TABLE "chat_participants" DROP CONSTRAINT "FK_b4129b3e21906ca57b503a1d834"`);
        await queryRunner.query(`ALTER TABLE "chat_participants" DROP CONSTRAINT "FK_9946d299e9ccfbee23aa40c5545"`);
        await queryRunner.query(`ALTER TABLE "blab_likes" DROP CONSTRAINT "FK_6a02fb4b2afef6af04f030a1c59"`);
        await queryRunner.query(`ALTER TABLE "blab_likes" DROP CONSTRAINT "FK_8a0152105b2e6a0c279c384dad3"`);
        await queryRunner.query(`ALTER TABLE "reply_likes" DROP CONSTRAINT "FK_ab114098af787728a1d33dd0d25"`);
        await queryRunner.query(`ALTER TABLE "reply_likes" DROP CONSTRAINT "FK_60cd31853a064c673a3d3324dc6"`);
        await queryRunner.query(`ALTER TABLE "texts" DROP CONSTRAINT "FK_fc650300b13333cbe5ae5fac281"`);
        await queryRunner.query(`ALTER TABLE "texts" DROP CONSTRAINT "FK_16d5fc6d4a731bbd3703793a49c"`);
        await queryRunner.query(`ALTER TABLE "message_read_status" DROP CONSTRAINT "FK_00956f27e567b20ea63956a94da"`);
        await queryRunner.query(`ALTER TABLE "message_read_status" DROP CONSTRAINT "FK_f8aaa4a571e96838b1e15d5ff63"`);
        await queryRunner.query(`ALTER TABLE "blabs" DROP CONSTRAINT "FK_ea5969bad99c59d4f0af17d4692"`);
        await queryRunner.query(`ALTER TABLE "replies" DROP CONSTRAINT "FK_3a74da2d3059288882a69be43fa"`);
        await queryRunner.query(`ALTER TABLE "replies" DROP CONSTRAINT "FK_34408818aba710d6ea7bb40358a"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_94e1183284db3e697031eb7775"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_a28a2c27629ac06a41720d01c3"`);
        await queryRunner.query(`DROP TABLE "user_following"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_da722d93356ae3119d6be40d98"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_a59d62cda8101214445e295cdc"`);
        await queryRunner.query(`DROP TABLE "user_followers"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_b4129b3e21906ca57b503a1d83"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_9946d299e9ccfbee23aa40c554"`);
        await queryRunner.query(`DROP TABLE "chat_participants"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_6a02fb4b2afef6af04f030a1c5"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_8a0152105b2e6a0c279c384dad"`);
        await queryRunner.query(`DROP TABLE "blab_likes"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_ab114098af787728a1d33dd0d2"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_60cd31853a064c673a3d3324dc"`);
        await queryRunner.query(`DROP TABLE "reply_likes"`);
        await queryRunner.query(`DROP TABLE "users"`);
        await queryRunner.query(`DROP TABLE "chat"`);
        await queryRunner.query(`DROP TABLE "texts"`);
        await queryRunner.query(`DROP TABLE "message_read_status"`);
        await queryRunner.query(`DROP TABLE "blabs"`);
        await queryRunner.query(`DROP TABLE "replies"`);
    }

}
