import type { MigrationInterface, QueryRunner } from "typeorm";

export class AddMigrationNewW3id1764310000000 implements MigrationInterface {
    name = "AddMigrationNewW3id1764310000000";

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "evault_migrations"
            ADD "newW3id" character varying
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "evault_migrations" DROP COLUMN "newW3id"
        `);
    }
}
