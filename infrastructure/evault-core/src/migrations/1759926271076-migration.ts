import { MigrationInterface, QueryRunner } from "typeorm";

export class Migration1759926271076 implements MigrationInterface {
    name = 'Migration1759926271076'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "notifications" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "eName" character varying NOT NULL, "title" character varying NOT NULL, "body" character varying NOT NULL, "data" jsonb, "delivered" boolean NOT NULL DEFAULT false, "deliveredAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_6a72c3c0f683f6462415e653c3a" PRIMARY KEY ("id"))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "notifications"`);
    }

}
