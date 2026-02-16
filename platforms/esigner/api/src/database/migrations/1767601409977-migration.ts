import { MigrationInterface, QueryRunner } from "typeorm";

export class Migration1767601409977 implements MigrationInterface {
    name = 'Migration1767601409977'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "signature_containers" DROP CONSTRAINT "FK_5632d70248b32f4cc82c6683bd0"`);
        await queryRunner.query(`ALTER TABLE "signature_containers" ADD CONSTRAINT "UQ_5632d70248b32f4cc82c6683bd0" UNIQUE ("fileSigneeId")`);
        await queryRunner.query(`ALTER TABLE "signature_containers" ADD CONSTRAINT "FK_5632d70248b32f4cc82c6683bd0" FOREIGN KEY ("fileSigneeId") REFERENCES "file_signees"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "signature_containers" DROP CONSTRAINT "FK_5632d70248b32f4cc82c6683bd0"`);
        await queryRunner.query(`ALTER TABLE "signature_containers" DROP CONSTRAINT "UQ_5632d70248b32f4cc82c6683bd0"`);
        await queryRunner.query(`ALTER TABLE "signature_containers" ADD CONSTRAINT "FK_5632d70248b32f4cc82c6683bd0" FOREIGN KEY ("fileSigneeId") REFERENCES "file_signees"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

}
