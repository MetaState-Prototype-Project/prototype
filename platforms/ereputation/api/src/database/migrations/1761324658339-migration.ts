import { MigrationInterface, QueryRunner } from "typeorm";

export class Migration1761324658339 implements MigrationInterface {
    name = 'Migration1761324658339'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "references" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "targetType" character varying NOT NULL, "targetId" character varying NOT NULL, "targetName" character varying NOT NULL, "content" text NOT NULL, "referenceType" character varying NOT NULL, "numericScore" integer, "authorId" uuid NOT NULL, "status" character varying, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_795ec632ca1153bf5ec99d656e5" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "calculations" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "targetType" character varying NOT NULL, "targetId" character varying NOT NULL, "targetName" character varying NOT NULL, "userValues" text NOT NULL, "calculatedScore" double precision NOT NULL, "calculationDetails" text, "calculatorId" uuid NOT NULL, "status" character varying NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_a57a12855a44935db91c2533b71" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "references" ADD CONSTRAINT "FK_98fc39160edc395b34d1960ed87" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "calculations" ADD CONSTRAINT "FK_9bc689175cd305ff8403d64b4a6" FOREIGN KEY ("calculatorId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "calculations" DROP CONSTRAINT "FK_9bc689175cd305ff8403d64b4a6"`);
        await queryRunner.query(`ALTER TABLE "references" DROP CONSTRAINT "FK_98fc39160edc395b34d1960ed87"`);
        await queryRunner.query(`DROP TABLE "calculations"`);
        await queryRunner.query(`DROP TABLE "references"`);
    }

}
