import { MigrationInterface, QueryRunner } from "typeorm";

export class Migration1755186562660 implements MigrationInterface {
    name = 'Migration1755186562660'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "group" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying, "description" character varying, "owner" character varying, "charter" text, "isPrivate" boolean NOT NULL DEFAULT false, "visibility" character varying NOT NULL DEFAULT 'public', "avatarUrl" character varying, "bannerUrl" character varying, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_256aa0fda9b1de1a73ee0b7106b" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "group_members" ("group_id" uuid NOT NULL, "user_id" uuid NOT NULL, CONSTRAINT "PK_f5939ee0ad233ad35e03f5c65c1" PRIMARY KEY ("group_id", "user_id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_2c840df5db52dc6b4a1b0b69c6" ON "group_members" ("group_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_20a555b299f75843aa53ff8b0e" ON "group_members" ("user_id") `);
        await queryRunner.query(`CREATE TABLE "group_admins" ("group_id" uuid NOT NULL, "user_id" uuid NOT NULL, CONSTRAINT "PK_a63ab4ea34529a63cdd55eed88d" PRIMARY KEY ("group_id", "user_id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_0ecd81bfecc31d4f804ece20ef" ON "group_admins" ("group_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_29bb650b1c5b1639dfb089f39a" ON "group_admins" ("user_id") `);
        await queryRunner.query(`CREATE TABLE "group_participants" ("group_id" uuid NOT NULL, "user_id" uuid NOT NULL, CONSTRAINT "PK_92021b85af6470d6b405e12f312" PRIMARY KEY ("group_id", "user_id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_e61f897ae7a7df4b56595adaae" ON "group_participants" ("group_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_bb1d0ab0d82e0a62fa55b7e841" ON "group_participants" ("user_id") `);
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
        await queryRunner.query(`DROP INDEX "public"."IDX_bb1d0ab0d82e0a62fa55b7e841"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_e61f897ae7a7df4b56595adaae"`);
        await queryRunner.query(`DROP TABLE "group_participants"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_29bb650b1c5b1639dfb089f39a"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_0ecd81bfecc31d4f804ece20ef"`);
        await queryRunner.query(`DROP TABLE "group_admins"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_20a555b299f75843aa53ff8b0e"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_2c840df5db52dc6b4a1b0b69c6"`);
        await queryRunner.query(`DROP TABLE "group_members"`);
        await queryRunner.query(`DROP TABLE "group"`);
    }

}
