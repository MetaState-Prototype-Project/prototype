import { MigrationInterface, QueryRunner } from "typeorm";

export class Migration1771588337031 implements MigrationInterface {
    name = 'Migration1771588337031'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."delegations_status_enum" AS ENUM('pending', 'active', 'rejected', 'revoked', 'used')`);
        await queryRunner.query(`CREATE TABLE "delegations" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "pollId" uuid NOT NULL, "delegatorId" uuid NOT NULL, "delegateId" uuid NOT NULL, "status" "public"."delegations_status_enum" NOT NULL DEFAULT 'pending', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_01f9fbbc9b3bf52236a4e951b19" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "votes" ADD "castById" uuid`);
        await queryRunner.query(`ALTER TABLE "votes" ADD CONSTRAINT "FK_c3f766036bdc68567015a3f6f9b" FOREIGN KEY ("castById") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "delegations" ADD CONSTRAINT "FK_32c81d839deb11bcfd8f83ba2f9" FOREIGN KEY ("pollId") REFERENCES "polls"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "delegations" ADD CONSTRAINT "FK_2efda215aa6a265a536fe68dcf6" FOREIGN KEY ("delegatorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "delegations" ADD CONSTRAINT "FK_2d4590d0c84a5ca333fd64e4c2a" FOREIGN KEY ("delegateId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "delegations" DROP CONSTRAINT "FK_2d4590d0c84a5ca333fd64e4c2a"`);
        await queryRunner.query(`ALTER TABLE "delegations" DROP CONSTRAINT "FK_2efda215aa6a265a536fe68dcf6"`);
        await queryRunner.query(`ALTER TABLE "delegations" DROP CONSTRAINT "FK_32c81d839deb11bcfd8f83ba2f9"`);
        await queryRunner.query(`ALTER TABLE "votes" DROP CONSTRAINT "FK_c3f766036bdc68567015a3f6f9b"`);
        await queryRunner.query(`ALTER TABLE "votes" DROP COLUMN "castById"`);
        await queryRunner.query(`DROP TABLE "delegations"`);
        await queryRunner.query(`DROP TYPE "public"."delegations_status_enum"`);
    }

}
