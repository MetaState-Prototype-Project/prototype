import { MigrationInterface, QueryRunner } from "typeorm";

export class Migration1755778782085 implements MigrationInterface {
    name = 'Migration1755778782085'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "poll_voting_states" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "pollId" uuid NOT NULL, "registeredVoters" text array NOT NULL DEFAULT '{}', "voterAnchors" jsonb, "commitments" jsonb, "proofs" jsonb, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_f81cc9b8d80829c08e57a2eca7e" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "poll_voting_states" ADD CONSTRAINT "FK_77578242dbebdbf7342a309e942" FOREIGN KEY ("pollId") REFERENCES "polls"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "poll_voting_states" DROP CONSTRAINT "FK_77578242dbebdbf7342a309e942"`);
        await queryRunner.query(`DROP TABLE "poll_voting_states"`);
    }

}
