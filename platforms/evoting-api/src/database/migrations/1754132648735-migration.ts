import { MigrationInterface, QueryRunner } from "typeorm";

export class Migration1754132648735 implements MigrationInterface {
    name = 'Migration1754132648735'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "account" ("id" character varying(36) NOT NULL, "accountId" text NOT NULL, "providerId" text NOT NULL, "userId" character varying(36) NOT NULL, "accessToken" text, "refreshToken" text, "idToken" text, "accessTokenExpiresAt" TIMESTAMP, "refreshTokenExpiresAt" TIMESTAMP, "scope" text, "password" text, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_54115ee388cdb6d86bb4bf5b2ea" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "session" ("id" character varying(36) NOT NULL, "expiresAt" TIMESTAMP NOT NULL, "token" text NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "ipAddress" text, "userAgent" text, "userId" character varying(36) NOT NULL, CONSTRAINT "PK_f55da76ac1c3ac420f444d2ff11" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "user" ("id" character varying(36) NOT NULL, "name" text NOT NULL, "email" character varying(255) NOT NULL, "emailVerified" boolean NOT NULL DEFAULT false, "image" text, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_cace4a159ff9f2512dd42373760" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "verification" ("id" character varying(36) NOT NULL, "identifier" text NOT NULL, "value" text NOT NULL, "expiresAt" TIMESTAMP NOT NULL, "createdAt" TIMESTAMP, "updatedAt" TIMESTAMP, CONSTRAINT "PK_f7e3a90ca384e71d6e2e93bb340" PRIMARY KEY ("id"))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "verification"`);
        await queryRunner.query(`DROP TABLE "user"`);
        await queryRunner.query(`DROP TABLE "session"`);
        await queryRunner.query(`DROP TABLE "account"`);
    }

}
