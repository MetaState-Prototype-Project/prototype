import { MigrationInterface, QueryRunner } from "typeorm";

export class Migration1749561069022 implements MigrationInterface {
    name = 'Migration1749561069022'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "__web3_id_mapping" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "localId" character varying NOT NULL, "metaEnvelopeId" character varying NOT NULL, "entityType" character varying NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_4c57c87c4ee60f42d9c6b0861c2" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_e6df8ee410baeffd472e93cdd2" ON "__web3_id_mapping" ("localId") `);
        await queryRunner.query(`CREATE INDEX "IDX_9bdab2968d15942d3e3187a620" ON "__web3_id_mapping" ("metaEnvelopeId") `);
        await queryRunner.query(`CREATE INDEX "IDX_f62e57b7b9f593f2e1715912c9" ON "__web3_id_mapping" ("entityType") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_f62e57b7b9f593f2e1715912c9"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_9bdab2968d15942d3e3187a620"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_e6df8ee410baeffd472e93cdd2"`);
        await queryRunner.query(`DROP TABLE "__web3_id_mapping"`);
    }

}
