import { MigrationInterface, QueryRunner } from "typeorm";

export class Migration1763623302938 implements MigrationInterface {
    name = 'Migration1763623302938'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "polls" DROP CONSTRAINT "FK_57e3240e3361bf5e1400ba0191d"`);
        await queryRunner.query(`ALTER TABLE "polls" DROP COLUMN "creatorId"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "polls" ADD "creatorId" uuid NOT NULL`);
        await queryRunner.query(`ALTER TABLE "polls" ADD CONSTRAINT "FK_57e3240e3361bf5e1400ba0191d" FOREIGN KEY ("creatorId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

}
