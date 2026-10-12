import { MigrationInterface, QueryRunner } from "typeorm";

export class EvaultRateLimitRule1791786717906 implements MigrationInterface {
    name = 'EvaultRateLimitRule1791786717906'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "evault_rate_limit_rule" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "kind" character varying NOT NULL, "subject" character varying(256) NOT NULL, "mode" character varying NOT NULL, "limitPerMinute" integer, "note" character varying(500), "updatedBy" character varying, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_evault_rate_limit_rule_subject" UNIQUE ("kind", "subject"), CONSTRAINT "CHK_evault_rate_limit_rule_kind" CHECK ("kind" IN ('platform', 'ip')), CONSTRAINT "CHK_evault_rate_limit_rule_mode" CHECK ("mode" IN ('limit', 'blocked', 'exempt')), CONSTRAINT "CHK_evault_rate_limit_rule_limit" CHECK (("mode" = 'limit') = ("limitPerMinute" IS NOT NULL)), CONSTRAINT "CHK_evault_rate_limit_rule_default" CHECK ("subject" <> '*' OR "mode" = 'limit'), CONSTRAINT "PK_evault_rate_limit_rule" PRIMARY KEY ("id"))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "evault_rate_limit_rule"`);
    }

}
