import { MigrationInterface, QueryRunner } from "typeorm";

export class Migration1755183162145 implements MigrationInterface {
    name = 'Migration1755183162145'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "user_followers" ("user_id" uuid NOT NULL, "follower_id" uuid NOT NULL, CONSTRAINT "PK_d7b47e785d7dbc74b2f22f30045" PRIMARY KEY ("user_id", "follower_id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_a59d62cda8101214445e295cdc" ON "user_followers" ("user_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_da722d93356ae3119d6be40d98" ON "user_followers" ("follower_id") `);
        await queryRunner.query(`CREATE TABLE "user_following" ("user_id" uuid NOT NULL, "following_id" uuid NOT NULL, CONSTRAINT "PK_5d7e9a83ee6f9b806d569068a30" PRIMARY KEY ("user_id", "following_id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_a28a2c27629ac06a41720d01c3" ON "user_following" ("user_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_94e1183284db3e697031eb7775" ON "user_following" ("following_id") `);
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
        await queryRunner.query(`DROP INDEX "public"."IDX_94e1183284db3e697031eb7775"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_a28a2c27629ac06a41720d01c3"`);
        await queryRunner.query(`DROP TABLE "user_following"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_da722d93356ae3119d6be40d98"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_a59d62cda8101214445e295cdc"`);
        await queryRunner.query(`DROP TABLE "user_followers"`);
    }

}
