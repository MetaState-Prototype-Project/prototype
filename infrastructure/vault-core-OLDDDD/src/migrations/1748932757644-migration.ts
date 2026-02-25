import { MigrationInterface, QueryRunner } from "typeorm";

export class Migration1748932757644 implements MigrationInterface {
    name = 'Migration1748932757644'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "verification" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "veriffId" character varying, "approved" boolean, "data" jsonb, "referenceId" character varying, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_f7e3a90ca384e71d6e2e93bb340" PRIMARY KEY ("id"))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "verification"`);
    }

}
