import type { MigrationInterface, QueryRunner } from "typeorm";

export class ClientLogo1790700000000 implements MigrationInterface {
    name = "ClientLogo1790700000000";

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TABLE "oidc_clients" ADD COLUMN "logo_url" text`,
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TABLE "oidc_clients" DROP COLUMN "logo_url"`,
        );
    }
}
