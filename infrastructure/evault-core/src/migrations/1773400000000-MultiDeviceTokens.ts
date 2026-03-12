import { MigrationInterface, QueryRunner } from "typeorm";

export class Migration1773400000000 implements MigrationInterface {
    name = "Migration1773400000000";

    public async up(queryRunner: QueryRunner): Promise<void> {
        // 1. Restructure device_token: collapse multi-row-per-eName into one-row-per-eName with tokens array

        await queryRunner.query(`
            CREATE TABLE "device_token_new" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "eName" character varying NOT NULL,
                "tokens" text[] NOT NULL DEFAULT '{}',
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_device_token_new" PRIMARY KEY ("id")
            )
        `);

        await queryRunner.query(`
            INSERT INTO "device_token_new" ("eName", "tokens", "createdAt", "updatedAt")
            SELECT
                "eName",
                array_agg(DISTINCT "token"),
                MIN("createdAt"),
                MAX("updatedAt")
            FROM "device_token"
            GROUP BY "eName"
        `);

        await queryRunner.query(`DROP TABLE "device_token"`);
        await queryRunner.query(`ALTER TABLE "device_token_new" RENAME TO "device_token"`);
        await queryRunner.query(`ALTER TABLE "device_token" RENAME CONSTRAINT "PK_device_token_new" TO "PK_device_token"`);
        await queryRunner.query(`CREATE UNIQUE INDEX "UQ_device_token_ename" ON "device_token" ("eName")`);

        // 2. Rename verification.fcmToken -> pushTokens (varchar -> text[])

        await queryRunner.query(`ALTER TABLE "verification" ADD "pushTokens" text[] DEFAULT '{}'`);
        await queryRunner.query(`
            UPDATE "verification"
            SET "pushTokens" = CASE
                WHEN "fcmToken" IS NOT NULL AND "fcmToken" != '' THEN ARRAY["fcmToken"]
                ELSE '{}'
            END
        `);
        await queryRunner.query(`ALTER TABLE "verification" DROP COLUMN "fcmToken"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Revert verification: pushTokens -> fcmToken
        await queryRunner.query(`ALTER TABLE "verification" ADD "fcmToken" character varying`);
        await queryRunner.query(`
            UPDATE "verification"
            SET "fcmToken" = CASE
                WHEN "pushTokens" IS NOT NULL AND array_length("pushTokens", 1) > 0 THEN "pushTokens"[1]
                ELSE NULL
            END
        `);
        await queryRunner.query(`ALTER TABLE "verification" DROP COLUMN "pushTokens"`);

        // Revert device_token: expand array rows back into individual rows
        await queryRunner.query(`DROP INDEX "UQ_device_token_ename"`);

        await queryRunner.query(`
            CREATE TABLE "device_token_old" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "eName" character varying NOT NULL,
                "token" character varying NOT NULL,
                "platform" character varying NOT NULL DEFAULT '',
                "deviceId" character varying NOT NULL DEFAULT '',
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_device_token_old" PRIMARY KEY ("id")
            )
        `);

        await queryRunner.query(`
            INSERT INTO "device_token_old" ("eName", "token", "createdAt", "updatedAt")
            SELECT "eName", unnest("tokens"), "createdAt", "updatedAt"
            FROM "device_token"
        `);

        await queryRunner.query(`DROP TABLE "device_token"`);
        await queryRunner.query(`ALTER TABLE "device_token_old" RENAME TO "device_token"`);
        await queryRunner.query(`ALTER TABLE "device_token" RENAME CONSTRAINT "PK_device_token_old" TO "PK_device_token"`);
        await queryRunner.query(`CREATE UNIQUE INDEX "UQ_device_token_ename_deviceid" ON "device_token" ("eName", "deviceId")`);
        await queryRunner.query(`CREATE INDEX "IDX_device_token_ename" ON "device_token" ("eName")`);
    }
}
