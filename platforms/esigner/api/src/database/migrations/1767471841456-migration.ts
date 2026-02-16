import { MigrationInterface, QueryRunner } from "typeorm";

export class Migration1767471841456 implements MigrationInterface {
    name = 'Migration1767471841456'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "handle" character varying, "name" character varying, "description" character varying, "avatarUrl" character varying, "bannerUrl" character varying, "ename" character varying, "isVerified" boolean NOT NULL DEFAULT false, "isPrivate" boolean NOT NULL DEFAULT false, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "isArchived" boolean NOT NULL DEFAULT false, CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "group" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying, "description" character varying, "owner" character varying, "charter" text, "isPrivate" boolean NOT NULL DEFAULT false, "visibility" character varying NOT NULL DEFAULT 'public', "ename" character varying, "avatarUrl" character varying, "bannerUrl" character varying, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_256aa0fda9b1de1a73ee0b7106b" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "signature_containers" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "fileId" uuid NOT NULL, "userId" uuid NOT NULL, "fileSigneeId" uuid, "md5Hash" text NOT NULL, "signature" text NOT NULL, "publicKey" text NOT NULL, "message" text NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_11d098c75e494a23c73f3514328" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "file_signees" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "fileId" uuid NOT NULL, "userId" uuid NOT NULL, "invitedBy" uuid NOT NULL, "status" character varying NOT NULL DEFAULT 'pending', "invitedAt" TIMESTAMP NOT NULL DEFAULT now(), "signedAt" TIMESTAMP, "declinedAt" TIMESTAMP, CONSTRAINT "PK_d1a81a42bd97653e49d9cd5b9f2" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "files" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying NOT NULL, "mimeType" character varying NOT NULL, "size" bigint NOT NULL, "md5Hash" text NOT NULL, "data" bytea NOT NULL, "ownerId" uuid NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_6c16b9093a142e0e7613b04a3d9" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "group_members" ("group_id" uuid NOT NULL, "user_id" uuid NOT NULL, CONSTRAINT "PK_f5939ee0ad233ad35e03f5c65c1" PRIMARY KEY ("group_id", "user_id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_2c840df5db52dc6b4a1b0b69c6" ON "group_members" ("group_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_20a555b299f75843aa53ff8b0e" ON "group_members" ("user_id") `);
        await queryRunner.query(`CREATE TABLE "group_admins" ("group_id" uuid NOT NULL, "user_id" uuid NOT NULL, CONSTRAINT "PK_a63ab4ea34529a63cdd55eed88d" PRIMARY KEY ("group_id", "user_id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_0ecd81bfecc31d4f804ece20ef" ON "group_admins" ("group_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_29bb650b1c5b1639dfb089f39a" ON "group_admins" ("user_id") `);
        await queryRunner.query(`CREATE TABLE "group_participants" ("group_id" uuid NOT NULL, "user_id" uuid NOT NULL, CONSTRAINT "PK_92021b85af6470d6b405e12f312" PRIMARY KEY ("group_id", "user_id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_e61f897ae7a7df4b56595adaae" ON "group_participants" ("group_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_bb1d0ab0d82e0a62fa55b7e841" ON "group_participants" ("user_id") `);
        await queryRunner.query(`ALTER TABLE "signature_containers" ADD CONSTRAINT "FK_9effe78087d666930d4f48d839a" FOREIGN KEY ("fileId") REFERENCES "files"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "signature_containers" ADD CONSTRAINT "FK_7fc1823b42014453d35e7591333" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "signature_containers" ADD CONSTRAINT "FK_5632d70248b32f4cc82c6683bd0" FOREIGN KEY ("fileSigneeId") REFERENCES "file_signees"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "file_signees" ADD CONSTRAINT "FK_e9d699ee070a08e3fb5959e0e0d" FOREIGN KEY ("fileId") REFERENCES "files"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "file_signees" ADD CONSTRAINT "FK_d60d292d3c1bb7c497aed89ea90" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "file_signees" ADD CONSTRAINT "FK_8ed26523517eae9d204085d5e6d" FOREIGN KEY ("invitedBy") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "files" ADD CONSTRAINT "FK_a23484d1055e34d75b25f616792" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
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
        await queryRunner.query(`ALTER TABLE "files" DROP CONSTRAINT "FK_a23484d1055e34d75b25f616792"`);
        await queryRunner.query(`ALTER TABLE "file_signees" DROP CONSTRAINT "FK_8ed26523517eae9d204085d5e6d"`);
        await queryRunner.query(`ALTER TABLE "file_signees" DROP CONSTRAINT "FK_d60d292d3c1bb7c497aed89ea90"`);
        await queryRunner.query(`ALTER TABLE "file_signees" DROP CONSTRAINT "FK_e9d699ee070a08e3fb5959e0e0d"`);
        await queryRunner.query(`ALTER TABLE "signature_containers" DROP CONSTRAINT "FK_5632d70248b32f4cc82c6683bd0"`);
        await queryRunner.query(`ALTER TABLE "signature_containers" DROP CONSTRAINT "FK_7fc1823b42014453d35e7591333"`);
        await queryRunner.query(`ALTER TABLE "signature_containers" DROP CONSTRAINT "FK_9effe78087d666930d4f48d839a"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_bb1d0ab0d82e0a62fa55b7e841"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_e61f897ae7a7df4b56595adaae"`);
        await queryRunner.query(`DROP TABLE "group_participants"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_29bb650b1c5b1639dfb089f39a"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_0ecd81bfecc31d4f804ece20ef"`);
        await queryRunner.query(`DROP TABLE "group_admins"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_20a555b299f75843aa53ff8b0e"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_2c840df5db52dc6b4a1b0b69c6"`);
        await queryRunner.query(`DROP TABLE "group_members"`);
        await queryRunner.query(`DROP TABLE "files"`);
        await queryRunner.query(`DROP TABLE "file_signees"`);
        await queryRunner.query(`DROP TABLE "signature_containers"`);
        await queryRunner.query(`DROP TABLE "group"`);
        await queryRunner.query(`DROP TABLE "users"`);
    }

}
