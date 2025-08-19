import { MigrationInterface, QueryRunner } from "typeorm";

export class Migration1755598750354 implements MigrationInterface {
    name = 'Migration1755598750354'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "charter_signature" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "groupId" uuid NOT NULL, "userId" uuid NOT NULL, "charterHash" text NOT NULL, "signature" text NOT NULL, "publicKey" text NOT NULL, "message" text NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_d566749a8805a43c54ad028deef" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "charter_signature" ADD CONSTRAINT "FK_e1f768c9d467cd20b0f45321626" FOREIGN KEY ("groupId") REFERENCES "group"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "charter_signature" ADD CONSTRAINT "FK_fb0db27afde8d484139b66628fd" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "charter_signature" DROP CONSTRAINT "FK_fb0db27afde8d484139b66628fd"`);
        await queryRunner.query(`ALTER TABLE "charter_signature" DROP CONSTRAINT "FK_e1f768c9d467cd20b0f45321626"`);
        await queryRunner.query(`DROP TABLE "charter_signature"`);
    }

}
