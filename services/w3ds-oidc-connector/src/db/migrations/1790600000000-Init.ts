import type { MigrationInterface, QueryRunner } from "typeorm";

export class Init1790600000000 implements MigrationInterface {
    name = "Init1790600000000";

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE "oidc_clients" (
                "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                "client_id" text NOT NULL,
                "secret_hash" text NOT NULL,
                "name" text NOT NULL,
                "owner_ename" text NOT NULL,
                "redirect_uris" jsonb NOT NULL,
                "synthetic_email" boolean NOT NULL DEFAULT false,
                "created_at" timestamptz NOT NULL DEFAULT now(),
                "updated_at" timestamptz NOT NULL DEFAULT now(),
                "secret_rotated_at" timestamptz NOT NULL DEFAULT now(),
                "last_used_at" timestamptz,
                CONSTRAINT "uq_oidc_clients_client_id" UNIQUE ("client_id")
            )
        `);
        await queryRunner.query(
            `CREATE INDEX "idx_oidc_clients_owner" ON "oidc_clients" ("owner_ename")`,
        );
        await queryRunner.query(`
            CREATE TABLE "oidc_client_events" (
                "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                "owner_ename" text NOT NULL,
                "client_id" text NOT NULL,
                "action" text NOT NULL,
                "at" timestamptz NOT NULL DEFAULT now(),
                CONSTRAINT "chk_oidc_client_events_action"
                    CHECK ("action" IN ('created', 'updated', 'secret_rotated', 'deleted'))
            )
        `);
        await queryRunner.query(
            `CREATE INDEX "idx_oidc_client_events_owner_action_at" ON "oidc_client_events" ("owner_ename", "action", "at")`,
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "oidc_client_events"`);
        await queryRunner.query(`DROP TABLE "oidc_clients"`);
    }
}
