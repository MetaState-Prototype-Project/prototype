import { MigrationInterface, QueryRunner } from "typeorm";

export class Migration1749032877158 implements MigrationInterface {
    name = 'Migration1749032877158'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "comments" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "text" text NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "isArchived" boolean NOT NULL DEFAULT false, "authorId" uuid, "postId" uuid, CONSTRAINT "PK_8bf68bc960f2b69e818bdb90dcb" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "posts" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "text" text NOT NULL, "images" text, "hashtags" text, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "isArchived" boolean NOT NULL DEFAULT false, "authorId" uuid, CONSTRAINT "PK_2829ac61eff60fcec60d7274b9e" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "messages" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "text" text NOT NULL, "isRead" boolean NOT NULL DEFAULT false, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "isArchived" boolean NOT NULL DEFAULT false, "senderId" uuid, "recipientId" uuid, CONSTRAINT "PK_18325f38ae6de43878487eff986" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "handle" character varying, "name" character varying, "description" character varying, "avatarUrl" character varying, "bannerUrl" character varying, "ename" character varying, "isVerified" boolean NOT NULL DEFAULT false, "isPrivate" boolean NOT NULL DEFAULT false, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "isArchived" boolean NOT NULL DEFAULT false, CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "comment_likes" ("comment_id" uuid NOT NULL, "user_id" uuid NOT NULL, CONSTRAINT "PK_660059072f131c773be5f37c475" PRIMARY KEY ("comment_id", "user_id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_2073bf518ef7017ec19319a65e" ON "comment_likes" ("comment_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_bdba9a10c64ff58d36b09e3ac4" ON "comment_likes" ("user_id") `);
        await queryRunner.query(`CREATE TABLE "post_likes" ("post_id" uuid NOT NULL, "user_id" uuid NOT NULL, CONSTRAINT "PK_8f64693922a9e8c4e2605850d0b" PRIMARY KEY ("post_id", "user_id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_b40d37469c501092203d285af8" ON "post_likes" ("post_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_9b9a7fc5eeff133cf71b8e06a7" ON "post_likes" ("user_id") `);
        await queryRunner.query(`CREATE TABLE "user_followers" ("user_id" uuid NOT NULL, "follower_id" uuid NOT NULL, CONSTRAINT "PK_d7b47e785d7dbc74b2f22f30045" PRIMARY KEY ("user_id", "follower_id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_a59d62cda8101214445e295cdc" ON "user_followers" ("user_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_da722d93356ae3119d6be40d98" ON "user_followers" ("follower_id") `);
        await queryRunner.query(`CREATE TABLE "user_following" ("user_id" uuid NOT NULL, "following_id" uuid NOT NULL, CONSTRAINT "PK_5d7e9a83ee6f9b806d569068a30" PRIMARY KEY ("user_id", "following_id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_a28a2c27629ac06a41720d01c3" ON "user_following" ("user_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_94e1183284db3e697031eb7775" ON "user_following" ("following_id") `);
        await queryRunner.query(`ALTER TABLE "comments" ADD CONSTRAINT "FK_4548cc4a409b8651ec75f70e280" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "comments" ADD CONSTRAINT "FK_e44ddaaa6d058cb4092f83ad61f" FOREIGN KEY ("postId") REFERENCES "posts"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "posts" ADD CONSTRAINT "FK_c5a322ad12a7bf95460c958e80e" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "messages" ADD CONSTRAINT "FK_2db9cf2b3ca111742793f6c37ce" FOREIGN KEY ("senderId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "messages" ADD CONSTRAINT "FK_f548818d46a1315d4e1d5e62da5" FOREIGN KEY ("recipientId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "comment_likes" ADD CONSTRAINT "FK_2073bf518ef7017ec19319a65e5" FOREIGN KEY ("comment_id") REFERENCES "comments"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "comment_likes" ADD CONSTRAINT "FK_bdba9a10c64ff58d36b09e3ac45" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "post_likes" ADD CONSTRAINT "FK_b40d37469c501092203d285af80" FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "post_likes" ADD CONSTRAINT "FK_9b9a7fc5eeff133cf71b8e06a7b" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
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
        await queryRunner.query(`ALTER TABLE "post_likes" DROP CONSTRAINT "FK_9b9a7fc5eeff133cf71b8e06a7b"`);
        await queryRunner.query(`ALTER TABLE "post_likes" DROP CONSTRAINT "FK_b40d37469c501092203d285af80"`);
        await queryRunner.query(`ALTER TABLE "comment_likes" DROP CONSTRAINT "FK_bdba9a10c64ff58d36b09e3ac45"`);
        await queryRunner.query(`ALTER TABLE "comment_likes" DROP CONSTRAINT "FK_2073bf518ef7017ec19319a65e5"`);
        await queryRunner.query(`ALTER TABLE "messages" DROP CONSTRAINT "FK_f548818d46a1315d4e1d5e62da5"`);
        await queryRunner.query(`ALTER TABLE "messages" DROP CONSTRAINT "FK_2db9cf2b3ca111742793f6c37ce"`);
        await queryRunner.query(`ALTER TABLE "posts" DROP CONSTRAINT "FK_c5a322ad12a7bf95460c958e80e"`);
        await queryRunner.query(`ALTER TABLE "comments" DROP CONSTRAINT "FK_e44ddaaa6d058cb4092f83ad61f"`);
        await queryRunner.query(`ALTER TABLE "comments" DROP CONSTRAINT "FK_4548cc4a409b8651ec75f70e280"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_94e1183284db3e697031eb7775"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_a28a2c27629ac06a41720d01c3"`);
        await queryRunner.query(`DROP TABLE "user_following"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_da722d93356ae3119d6be40d98"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_a59d62cda8101214445e295cdc"`);
        await queryRunner.query(`DROP TABLE "user_followers"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_9b9a7fc5eeff133cf71b8e06a7"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_b40d37469c501092203d285af8"`);
        await queryRunner.query(`DROP TABLE "post_likes"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_bdba9a10c64ff58d36b09e3ac4"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_2073bf518ef7017ec19319a65e"`);
        await queryRunner.query(`DROP TABLE "comment_likes"`);
        await queryRunner.query(`DROP TABLE "users"`);
        await queryRunner.query(`DROP TABLE "messages"`);
        await queryRunner.query(`DROP TABLE "posts"`);
        await queryRunner.query(`DROP TABLE "comments"`);
    }

}
