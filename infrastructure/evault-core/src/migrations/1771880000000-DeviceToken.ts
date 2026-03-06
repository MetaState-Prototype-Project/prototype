import { MigrationInterface, QueryRunner } from "typeorm";

export class Migration1771880000000 implements MigrationInterface {
    name = "Migration1771880000000";

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE "device_token" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "eName" character varying NOT NULL,
                "token" character varying NOT NULL,
                "platform" character varying NOT NULL,
                "deviceId" character varying NOT NULL,
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_device_token" PRIMARY KEY ("id")
            )
        `);
        await queryRunner.query(
            `CREATE UNIQUE INDEX "UQ_device_token_ename_deviceid" ON "device_token" ("eName", "deviceId")`,
        );
        await queryRunner.query(
            `CREATE INDEX "IDX_device_token_ename" ON "device_token" ("eName")`,
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "UQ_device_token_ename_deviceid"`);
        await queryRunner.query(`DROP INDEX "IDX_device_token_ename"`);
        await queryRunner.query(`DROP TABLE "device_token"`);
    }
}
