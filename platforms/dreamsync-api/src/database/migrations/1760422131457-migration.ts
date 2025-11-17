import { MigrationInterface, QueryRunner } from "typeorm";

export class Migration1760422131457 implements MigrationInterface {
    name = 'Migration1760422131457'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "group" ADD "originalMatchParticipants" json`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "group" DROP COLUMN "originalMatchParticipants"`);
    }

}
