import { MigrationInterface, QueryRunner } from "typeorm";

export class AnonErefs1773718262631 implements MigrationInterface {
    name = 'AnonErefs1773718262631'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "references" ADD "anonymous" boolean NOT NULL DEFAULT false`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "references" DROP COLUMN "anonymous"`);
    }

}
