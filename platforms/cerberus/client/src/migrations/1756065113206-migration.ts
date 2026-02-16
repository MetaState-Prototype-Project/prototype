import { MigrationInterface, QueryRunner } from "typeorm";

export class Migration1756065113206 implements MigrationInterface {
    name = 'Migration1756065113206'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "group" ADD "ename" character varying`);
        await queryRunner.query(`ALTER TABLE "voting_observations" DROP CONSTRAINT "FK_e413458062c606a628a561ed8b2"`);
        await queryRunner.query(`ALTER TABLE "voting_observations" ALTER COLUMN "owner" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "voting_observations" ADD CONSTRAINT "FK_e413458062c606a628a561ed8b2" FOREIGN KEY ("owner") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "voting_observations" DROP CONSTRAINT "FK_e413458062c606a628a561ed8b2"`);
        await queryRunner.query(`ALTER TABLE "voting_observations" ALTER COLUMN "owner" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "voting_observations" ADD CONSTRAINT "FK_e413458062c606a628a561ed8b2" FOREIGN KEY ("owner") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "group" DROP COLUMN "ename"`);
    }

}
