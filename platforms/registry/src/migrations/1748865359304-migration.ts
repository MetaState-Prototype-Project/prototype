import { MigrationInterface, QueryRunner } from "typeorm";

export class Migration1748865359304 implements MigrationInterface {
    name = 'Migration1748865359304'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "vault" ("id" SERIAL NOT NULL, "ename" character varying NOT NULL, "uri" character varying NOT NULL, "evault" character varying NOT NULL, CONSTRAINT "PK_dd0898234c77f9d97585171ac59" PRIMARY KEY ("id"))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "vault"`);
    }

}
