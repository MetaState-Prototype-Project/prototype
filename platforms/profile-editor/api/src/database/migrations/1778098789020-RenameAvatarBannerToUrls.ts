import { MigrationInterface, QueryRunner } from "typeorm";

export class RenameAvatarBannerToUrls1778098789020 implements MigrationInterface {
	name = "RenameAvatarBannerToUrls1778098789020";

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(
			`ALTER TABLE "users" RENAME COLUMN "avatar" TO "avatarUrl"`,
		);
		await queryRunner.query(
			`ALTER TABLE "users" RENAME COLUMN "banner" TO "bannerUrl"`,
		);
		// Legacy values were file-manager file IDs, not URLs. Clear them so
		// the next upload populates a real URL via the User Ontology sync.
		await queryRunner.query(
			`UPDATE "users" SET "avatarUrl" = NULL WHERE "avatarUrl" IS NOT NULL AND "avatarUrl" NOT LIKE 'http%'`,
		);
		await queryRunner.query(
			`UPDATE "users" SET "bannerUrl" = NULL WHERE "bannerUrl" IS NOT NULL AND "bannerUrl" NOT LIKE 'http%'`,
		);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(
			`ALTER TABLE "users" RENAME COLUMN "avatarUrl" TO "avatar"`,
		);
		await queryRunner.query(
			`ALTER TABLE "users" RENAME COLUMN "bannerUrl" TO "banner"`,
		);
	}
}
