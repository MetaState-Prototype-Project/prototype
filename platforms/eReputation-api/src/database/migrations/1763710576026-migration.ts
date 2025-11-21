import { MigrationInterface, QueryRunner } from "typeorm";

export class Migration1763710576026 implements MigrationInterface {
    name = 'Migration1763710576026'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "reference_signatures" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "referenceId" uuid NOT NULL, "userId" uuid NOT NULL, "referenceHash" text NOT NULL, "signature" text NOT NULL, "publicKey" text NOT NULL, "message" text NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_e13239bee10fe5f7a990d5fbee4" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "reference_signatures" ADD CONSTRAINT "FK_63d30e071b1bde272650ddd4c50" FOREIGN KEY ("referenceId") REFERENCES "references"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "reference_signatures" ADD CONSTRAINT "FK_273a89a0507f9304a2aa1839b9d" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "reference_signatures" DROP CONSTRAINT "FK_273a89a0507f9304a2aa1839b9d"`);
        await queryRunner.query(`ALTER TABLE "reference_signatures" DROP CONSTRAINT "FK_63d30e071b1bde272650ddd4c50"`);
        await queryRunner.query(`DROP TABLE "reference_signatures"`);
    }

}
