import { MigrationInterface, QueryRunner } from "typeorm";

export class Migration1772851200000 implements MigrationInterface {
    name = 'Migration1772851200000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."polls_status_enum" AS ENUM('draft', 'active', 'ended')`);
        await queryRunner.query(`ALTER TABLE "polls" ADD "status" "public"."polls_status_enum" NOT NULL DEFAULT 'active'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "polls" DROP COLUMN "status"`);
        await queryRunner.query(`DROP TYPE "public"."polls_status_enum"`);
    }
}
