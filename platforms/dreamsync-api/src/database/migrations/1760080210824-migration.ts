import { MigrationInterface, QueryRunner } from "typeorm";

export class Migration1760080210824 implements MigrationInterface {
    name = 'Migration1760080210824'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."matches_type_enum" AS ENUM('private', 'group')`);
        await queryRunner.query(`CREATE TYPE "public"."matches_status_enum" AS ENUM('pending', 'accepted', 'declined', 'expired')`);
        await queryRunner.query(`CREATE TABLE "matches" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "type" "public"."matches_type_enum" NOT NULL, "status" "public"."matches_status_enum" NOT NULL DEFAULT 'pending', "reason" text NOT NULL, "matchData" jsonb NOT NULL, "userAId" uuid NOT NULL, "userBId" uuid NOT NULL, "wishlistId" uuid NOT NULL, "expiresAt" TIMESTAMP, "metadata" jsonb, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_8a22c7b2e0828988d51256117f4" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "wishlists" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "title" character varying(255) NOT NULL, "content" text NOT NULL, "isActive" boolean NOT NULL DEFAULT true, "isPublic" boolean NOT NULL DEFAULT false, "metadata" jsonb, "userId" uuid NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_d0a37f2848c5d268d315325f359" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "matches" ADD CONSTRAINT "FK_adbd18c287fbca2740ad8d0926d" FOREIGN KEY ("userAId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "matches" ADD CONSTRAINT "FK_7b59dd3de4f5041df34607ba970" FOREIGN KEY ("userBId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "matches" ADD CONSTRAINT "FK_ddcc74420c8eccaf83ec7d9607b" FOREIGN KEY ("wishlistId") REFERENCES "wishlists"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "wishlists" ADD CONSTRAINT "FK_4f3c30555daa6ab0b70a1db772c" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "wishlists" DROP CONSTRAINT "FK_4f3c30555daa6ab0b70a1db772c"`);
        await queryRunner.query(`ALTER TABLE "matches" DROP CONSTRAINT "FK_ddcc74420c8eccaf83ec7d9607b"`);
        await queryRunner.query(`ALTER TABLE "matches" DROP CONSTRAINT "FK_7b59dd3de4f5041df34607ba970"`);
        await queryRunner.query(`ALTER TABLE "matches" DROP CONSTRAINT "FK_adbd18c287fbca2740ad8d0926d"`);
        await queryRunner.query(`DROP TABLE "wishlists"`);
        await queryRunner.query(`DROP TABLE "matches"`);
        await queryRunner.query(`DROP TYPE "public"."matches_status_enum"`);
        await queryRunner.query(`DROP TYPE "public"."matches_type_enum"`);
    }

}
