import { MigrationInterface, QueryRunner } from "typeorm";

export class Migration1767604964259 implements MigrationInterface {
    name = 'Migration1767604964259'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "handle" character varying, "name" character varying, "description" character varying, "avatarUrl" character varying, "bannerUrl" character varying, "ename" character varying, "isVerified" boolean NOT NULL DEFAULT false, "isPrivate" boolean NOT NULL DEFAULT false, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "isArchived" boolean NOT NULL DEFAULT false, CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "messages" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "text" text NOT NULL, "isSystemMessage" boolean NOT NULL DEFAULT false, "voteId" uuid, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "isArchived" boolean NOT NULL DEFAULT false, "senderId" uuid, "groupId" uuid, CONSTRAINT "PK_18325f38ae6de43878487eff986" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "group" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying, "description" character varying, "owner" character varying, "charter" text, "isPrivate" boolean NOT NULL DEFAULT false, "visibility" character varying NOT NULL DEFAULT 'public', "ename" character varying, "avatarUrl" character varying, "bannerUrl" character varying, "originalMatchParticipants" json, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_256aa0fda9b1de1a73ee0b7106b" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "tags" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying NOT NULL, "color" character varying, "ownerId" uuid NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_e7dc17249a1148a1970748eda99" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "folders" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying NOT NULL, "parentFolderId" uuid, "ownerId" uuid NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_8578bd31b0e7f6d6c2480dbbca8" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "signature_containers" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "fileId" uuid NOT NULL, "userId" uuid NOT NULL, "fileSigneeId" character varying, "md5Hash" text NOT NULL, "signature" text NOT NULL, "publicKey" text NOT NULL, "message" text NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_11d098c75e494a23c73f3514328" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "files" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying NOT NULL, "displayName" character varying, "description" text, "mimeType" character varying NOT NULL, "size" bigint NOT NULL, "md5Hash" text NOT NULL, "data" bytea NOT NULL, "ownerId" uuid NOT NULL, "folderId" uuid, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_6c16b9093a142e0e7613b04a3d9" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "user_evault_mappings" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "localUserId" character varying NOT NULL, "evaultW3id" character varying NOT NULL, "evaultUri" character varying NOT NULL, "userProfileId" character varying, "userProfileData" jsonb, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_744ddb4ddca6af2de54773e9213" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "file_access" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "fileId" uuid NOT NULL, "userId" uuid NOT NULL, "grantedBy" uuid NOT NULL, "permission" character varying NOT NULL DEFAULT 'view', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_4f91934346cfc7e72466111a1bf" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "folder_access" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "folderId" uuid NOT NULL, "userId" uuid NOT NULL, "grantedBy" uuid NOT NULL, "permission" character varying NOT NULL DEFAULT 'view', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_900ccfc7f33cfeee529ba9d53af" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "group_members" ("group_id" uuid NOT NULL, "user_id" uuid NOT NULL, CONSTRAINT "PK_f5939ee0ad233ad35e03f5c65c1" PRIMARY KEY ("group_id", "user_id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_2c840df5db52dc6b4a1b0b69c6" ON "group_members" ("group_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_20a555b299f75843aa53ff8b0e" ON "group_members" ("user_id") `);
        await queryRunner.query(`CREATE TABLE "group_admins" ("group_id" uuid NOT NULL, "user_id" uuid NOT NULL, CONSTRAINT "PK_a63ab4ea34529a63cdd55eed88d" PRIMARY KEY ("group_id", "user_id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_0ecd81bfecc31d4f804ece20ef" ON "group_admins" ("group_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_29bb650b1c5b1639dfb089f39a" ON "group_admins" ("user_id") `);
        await queryRunner.query(`CREATE TABLE "group_participants" ("group_id" uuid NOT NULL, "user_id" uuid NOT NULL, CONSTRAINT "PK_92021b85af6470d6b405e12f312" PRIMARY KEY ("group_id", "user_id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_e61f897ae7a7df4b56595adaae" ON "group_participants" ("group_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_bb1d0ab0d82e0a62fa55b7e841" ON "group_participants" ("user_id") `);
        await queryRunner.query(`CREATE TABLE "folder_tags" ("folderId" uuid NOT NULL, "tagId" uuid NOT NULL, CONSTRAINT "PK_f4915bb4e5d316b9200c78ac8e2" PRIMARY KEY ("folderId", "tagId"))`);
        await queryRunner.query(`CREATE INDEX "IDX_b407e9ed1bdb16b03b0a823a08" ON "folder_tags" ("folderId") `);
        await queryRunner.query(`CREATE INDEX "IDX_5e9a3bac68bad0de83835df44c" ON "folder_tags" ("tagId") `);
        await queryRunner.query(`CREATE TABLE "file_tags" ("fileId" uuid NOT NULL, "tagId" uuid NOT NULL, CONSTRAINT "PK_ecab73fa9f86d642d318f037e45" PRIMARY KEY ("fileId", "tagId"))`);
        await queryRunner.query(`CREATE INDEX "IDX_31dc65f6c8eb331dafec56d775" ON "file_tags" ("fileId") `);
        await queryRunner.query(`CREATE INDEX "IDX_9055162d8ed81e7ce50c68e837" ON "file_tags" ("tagId") `);
        await queryRunner.query(`ALTER TABLE "messages" ADD CONSTRAINT "FK_2db9cf2b3ca111742793f6c37ce" FOREIGN KEY ("senderId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "messages" ADD CONSTRAINT "FK_438f09ab5b4bbcd27683eac2a5e" FOREIGN KEY ("groupId") REFERENCES "group"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "tags" ADD CONSTRAINT "FK_8ce74535e58cbab22452bc758cb" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "folders" ADD CONSTRAINT "FK_6228242ce9f7a8f3aec9397c6a7" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "folders" ADD CONSTRAINT "FK_d33cb81c88bba50eacc6eb26951" FOREIGN KEY ("parentFolderId") REFERENCES "folders"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "signature_containers" ADD CONSTRAINT "FK_9effe78087d666930d4f48d839a" FOREIGN KEY ("fileId") REFERENCES "files"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "signature_containers" ADD CONSTRAINT "FK_7fc1823b42014453d35e7591333" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "files" ADD CONSTRAINT "FK_a23484d1055e34d75b25f616792" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "files" ADD CONSTRAINT "FK_24dfe39188240d442f380dd8c04" FOREIGN KEY ("folderId") REFERENCES "folders"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "file_access" ADD CONSTRAINT "FK_397ca282d50517817262e3427e6" FOREIGN KEY ("fileId") REFERENCES "files"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "file_access" ADD CONSTRAINT "FK_73775d0a6f317e5ca5723fb4d62" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "file_access" ADD CONSTRAINT "FK_722ea5cc318e53ca7a587c56e61" FOREIGN KEY ("grantedBy") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "folder_access" ADD CONSTRAINT "FK_3ec99e38dae197e09f183bfcc71" FOREIGN KEY ("folderId") REFERENCES "folders"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "folder_access" ADD CONSTRAINT "FK_cfe553dda20935a3383ffc8f6f9" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "folder_access" ADD CONSTRAINT "FK_953144dbdd75265c4b1ff1c8607" FOREIGN KEY ("grantedBy") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "group_members" ADD CONSTRAINT "FK_2c840df5db52dc6b4a1b0b69c6e" FOREIGN KEY ("group_id") REFERENCES "group"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "group_members" ADD CONSTRAINT "FK_20a555b299f75843aa53ff8b0ee" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "group_admins" ADD CONSTRAINT "FK_0ecd81bfecc31d4f804ece20efc" FOREIGN KEY ("group_id") REFERENCES "group"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "group_admins" ADD CONSTRAINT "FK_29bb650b1c5b1639dfb089f39a7" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "group_participants" ADD CONSTRAINT "FK_e61f897ae7a7df4b56595adaae7" FOREIGN KEY ("group_id") REFERENCES "group"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "group_participants" ADD CONSTRAINT "FK_bb1d0ab0d82e0a62fa55b7e8411" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "folder_tags" ADD CONSTRAINT "FK_b407e9ed1bdb16b03b0a823a08c" FOREIGN KEY ("folderId") REFERENCES "folders"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "folder_tags" ADD CONSTRAINT "FK_5e9a3bac68bad0de83835df44c4" FOREIGN KEY ("tagId") REFERENCES "tags"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "file_tags" ADD CONSTRAINT "FK_31dc65f6c8eb331dafec56d7753" FOREIGN KEY ("fileId") REFERENCES "files"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "file_tags" ADD CONSTRAINT "FK_9055162d8ed81e7ce50c68e837b" FOREIGN KEY ("tagId") REFERENCES "tags"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "file_tags" DROP CONSTRAINT "FK_9055162d8ed81e7ce50c68e837b"`);
        await queryRunner.query(`ALTER TABLE "file_tags" DROP CONSTRAINT "FK_31dc65f6c8eb331dafec56d7753"`);
        await queryRunner.query(`ALTER TABLE "folder_tags" DROP CONSTRAINT "FK_5e9a3bac68bad0de83835df44c4"`);
        await queryRunner.query(`ALTER TABLE "folder_tags" DROP CONSTRAINT "FK_b407e9ed1bdb16b03b0a823a08c"`);
        await queryRunner.query(`ALTER TABLE "group_participants" DROP CONSTRAINT "FK_bb1d0ab0d82e0a62fa55b7e8411"`);
        await queryRunner.query(`ALTER TABLE "group_participants" DROP CONSTRAINT "FK_e61f897ae7a7df4b56595adaae7"`);
        await queryRunner.query(`ALTER TABLE "group_admins" DROP CONSTRAINT "FK_29bb650b1c5b1639dfb089f39a7"`);
        await queryRunner.query(`ALTER TABLE "group_admins" DROP CONSTRAINT "FK_0ecd81bfecc31d4f804ece20efc"`);
        await queryRunner.query(`ALTER TABLE "group_members" DROP CONSTRAINT "FK_20a555b299f75843aa53ff8b0ee"`);
        await queryRunner.query(`ALTER TABLE "group_members" DROP CONSTRAINT "FK_2c840df5db52dc6b4a1b0b69c6e"`);
        await queryRunner.query(`ALTER TABLE "folder_access" DROP CONSTRAINT "FK_953144dbdd75265c4b1ff1c8607"`);
        await queryRunner.query(`ALTER TABLE "folder_access" DROP CONSTRAINT "FK_cfe553dda20935a3383ffc8f6f9"`);
        await queryRunner.query(`ALTER TABLE "folder_access" DROP CONSTRAINT "FK_3ec99e38dae197e09f183bfcc71"`);
        await queryRunner.query(`ALTER TABLE "file_access" DROP CONSTRAINT "FK_722ea5cc318e53ca7a587c56e61"`);
        await queryRunner.query(`ALTER TABLE "file_access" DROP CONSTRAINT "FK_73775d0a6f317e5ca5723fb4d62"`);
        await queryRunner.query(`ALTER TABLE "file_access" DROP CONSTRAINT "FK_397ca282d50517817262e3427e6"`);
        await queryRunner.query(`ALTER TABLE "files" DROP CONSTRAINT "FK_24dfe39188240d442f380dd8c04"`);
        await queryRunner.query(`ALTER TABLE "files" DROP CONSTRAINT "FK_a23484d1055e34d75b25f616792"`);
        await queryRunner.query(`ALTER TABLE "signature_containers" DROP CONSTRAINT "FK_7fc1823b42014453d35e7591333"`);
        await queryRunner.query(`ALTER TABLE "signature_containers" DROP CONSTRAINT "FK_9effe78087d666930d4f48d839a"`);
        await queryRunner.query(`ALTER TABLE "folders" DROP CONSTRAINT "FK_d33cb81c88bba50eacc6eb26951"`);
        await queryRunner.query(`ALTER TABLE "folders" DROP CONSTRAINT "FK_6228242ce9f7a8f3aec9397c6a7"`);
        await queryRunner.query(`ALTER TABLE "tags" DROP CONSTRAINT "FK_8ce74535e58cbab22452bc758cb"`);
        await queryRunner.query(`ALTER TABLE "messages" DROP CONSTRAINT "FK_438f09ab5b4bbcd27683eac2a5e"`);
        await queryRunner.query(`ALTER TABLE "messages" DROP CONSTRAINT "FK_2db9cf2b3ca111742793f6c37ce"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_9055162d8ed81e7ce50c68e837"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_31dc65f6c8eb331dafec56d775"`);
        await queryRunner.query(`DROP TABLE "file_tags"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_5e9a3bac68bad0de83835df44c"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_b407e9ed1bdb16b03b0a823a08"`);
        await queryRunner.query(`DROP TABLE "folder_tags"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_bb1d0ab0d82e0a62fa55b7e841"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_e61f897ae7a7df4b56595adaae"`);
        await queryRunner.query(`DROP TABLE "group_participants"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_29bb650b1c5b1639dfb089f39a"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_0ecd81bfecc31d4f804ece20ef"`);
        await queryRunner.query(`DROP TABLE "group_admins"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_20a555b299f75843aa53ff8b0e"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_2c840df5db52dc6b4a1b0b69c6"`);
        await queryRunner.query(`DROP TABLE "group_members"`);
        await queryRunner.query(`DROP TABLE "folder_access"`);
        await queryRunner.query(`DROP TABLE "file_access"`);
        await queryRunner.query(`DROP TABLE "user_evault_mappings"`);
        await queryRunner.query(`DROP TABLE "files"`);
        await queryRunner.query(`DROP TABLE "signature_containers"`);
        await queryRunner.query(`DROP TABLE "folders"`);
        await queryRunner.query(`DROP TABLE "tags"`);
        await queryRunner.query(`DROP TABLE "group"`);
        await queryRunner.query(`DROP TABLE "messages"`);
        await queryRunner.query(`DROP TABLE "users"`);
    }

}
