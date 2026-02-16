import { MigrationInterface, QueryRunner } from "typeorm";

export class Migration1763660768132 implements MigrationInterface {
    name = 'Migration1763660768132'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "wishlists" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "title" character varying(255) NOT NULL, "content" text NOT NULL, "isActive" boolean NOT NULL DEFAULT true, "isPublic" boolean NOT NULL DEFAULT false, "metadata" jsonb, "userId" uuid NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_d0a37f2848c5d268d315325f359" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "wishlists" ADD CONSTRAINT "FK_4f3c30555daa6ab0b70a1db772c" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "wishlists" DROP CONSTRAINT "FK_4f3c30555daa6ab0b70a1db772c"`);
        await queryRunner.query(`DROP TABLE "wishlists"`);
    }

}
