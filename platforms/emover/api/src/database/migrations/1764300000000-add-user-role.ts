import { MigrationInterface, QueryRunner } from "typeorm";

export class AddUserRole1764300000000 implements MigrationInterface {
    name = "AddUserRole1764300000000";

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TYPE "user_role_enum" AS ENUM('user', 'admin')
        `);
        await queryRunner.query(`
            ALTER TABLE "users" 
            ADD "role" "user_role_enum" NOT NULL DEFAULT 'user'
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "users" DROP COLUMN "role"
        `);
        await queryRunner.query(`
            DROP TYPE "user_role_enum"
        `);
    }
}
