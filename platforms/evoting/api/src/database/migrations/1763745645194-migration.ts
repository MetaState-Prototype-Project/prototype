import { MigrationInterface, QueryRunner } from "typeorm";

export class Migration1763745645194 implements MigrationInterface {
    name = 'Migration1763745645194'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "vote_reputation_results" DROP CONSTRAINT "FK_292664ed7ffc8782ab097e28ba5"`);
        await queryRunner.query(`ALTER TABLE "vote_reputation_results" ALTER COLUMN "groupId" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "vote_reputation_results" ADD CONSTRAINT "FK_292664ed7ffc8782ab097e28ba5" FOREIGN KEY ("groupId") REFERENCES "group"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "vote_reputation_results" DROP CONSTRAINT "FK_292664ed7ffc8782ab097e28ba5"`);
        await queryRunner.query(`ALTER TABLE "vote_reputation_results" ALTER COLUMN "groupId" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "vote_reputation_results" ADD CONSTRAINT "FK_292664ed7ffc8782ab097e28ba5" FOREIGN KEY ("groupId") REFERENCES "group"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

}
