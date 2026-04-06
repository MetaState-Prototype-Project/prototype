import { MigrationInterface, QueryRunner } from "typeorm";

export class RenameAvatarBannerColumns1775600000000 implements MigrationInterface {
    name = 'RenameAvatarBannerColumns1775600000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" RENAME COLUMN "avatarFileId" TO "avatar"`);
        await queryRunner.query(`ALTER TABLE "users" RENAME COLUMN "bannerFileId" TO "banner"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" RENAME COLUMN "avatar" TO "avatarFileId"`);
        await queryRunner.query(`ALTER TABLE "users" RENAME COLUMN "banner" TO "bannerFileId"`);
    }
}
