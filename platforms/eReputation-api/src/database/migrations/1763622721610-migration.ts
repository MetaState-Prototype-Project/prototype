import { MigrationInterface, QueryRunner } from "typeorm";

export class Migration1763622721610 implements MigrationInterface {
    name = 'Migration1763622721610'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "vote_reputation_results" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "pollId" uuid NOT NULL, "groupId" uuid NOT NULL, "results" jsonb NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_cbdd7662c8c8bdc281086fba0ed" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."polls_votingweight_enum" AS ENUM('1p1v', 'ereputation')`);
        await queryRunner.query(`ALTER TABLE "polls" ADD "votingWeight" "public"."polls_votingweight_enum" NOT NULL DEFAULT '1p1v'`);
        await queryRunner.query(`ALTER TABLE "vote_reputation_results" ADD CONSTRAINT "FK_f3dd3537bf6ab2e12be9a9ec7f5" FOREIGN KEY ("pollId") REFERENCES "polls"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "vote_reputation_results" ADD CONSTRAINT "FK_292664ed7ffc8782ab097e28ba5" FOREIGN KEY ("groupId") REFERENCES "group"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "vote_reputation_results" DROP CONSTRAINT "FK_292664ed7ffc8782ab097e28ba5"`);
        await queryRunner.query(`ALTER TABLE "vote_reputation_results" DROP CONSTRAINT "FK_f3dd3537bf6ab2e12be9a9ec7f5"`);
        await queryRunner.query(`ALTER TABLE "polls" DROP COLUMN "votingWeight"`);
        await queryRunner.query(`DROP TYPE "public"."polls_votingweight_enum"`);
        await queryRunner.query(`DROP TABLE "vote_reputation_results"`);
    }

}
