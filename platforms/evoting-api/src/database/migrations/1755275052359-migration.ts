import { MigrationInterface, QueryRunner } from "typeorm";

export class Migration1755275052359 implements MigrationInterface {
    name = 'Migration1755275052359'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "messages" ADD "voteId" uuid`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "messages" DROP COLUMN "voteId"`);
    }

}
