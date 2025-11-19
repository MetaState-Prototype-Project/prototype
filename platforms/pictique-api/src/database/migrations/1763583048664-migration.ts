import { MigrationInterface, QueryRunner } from "typeorm";

export class Migration1763583048664 implements MigrationInterface {
    name = 'Migration1763583048664'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "chat_admins" ("chat_id" uuid NOT NULL, "user_id" uuid NOT NULL, CONSTRAINT "PK_52e29f1cfeb7ee78bf3429ce782" PRIMARY KEY ("chat_id", "user_id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_06bea6d1e446fcb8cb66c17c6b" ON "chat_admins" ("chat_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_d27fdc7aaaa09b1fbfde71f548" ON "chat_admins" ("user_id") `);
        await queryRunner.query(`ALTER TABLE "chat_admins" ADD CONSTRAINT "FK_06bea6d1e446fcb8cb66c17c6b4" FOREIGN KEY ("chat_id") REFERENCES "chat"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "chat_admins" ADD CONSTRAINT "FK_d27fdc7aaaa09b1fbfde71f5489" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "chat_admins" DROP CONSTRAINT "FK_d27fdc7aaaa09b1fbfde71f5489"`);
        await queryRunner.query(`ALTER TABLE "chat_admins" DROP CONSTRAINT "FK_06bea6d1e446fcb8cb66c17c6b4"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_d27fdc7aaaa09b1fbfde71f548"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_06bea6d1e446fcb8cb66c17c6b"`);
        await queryRunner.query(`DROP TABLE "chat_admins"`);
    }

}
