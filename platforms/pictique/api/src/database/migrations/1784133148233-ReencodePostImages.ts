import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Re-encode the `posts.images` column from the legacy `simple-array` format
 * (naive comma-join) to `simple-json` (JSON.stringify/parse).
 *
 * Both column types compile down to a plain `text` column, so there is no
 * schema change — only the stored payloads need converting. Without this, rows
 * written under the old encoding would throw a JSON.parse error the first time
 * the entity is read back after the decorator switches to `simple-json`.
 *
 * Base64 data URLs (`data:<mime>;base64,<payload>`) always contain a comma in
 * their MIME prefix, so the old comma-join is ambiguous. We recover the
 * original array by splitting only on commas that immediately precede a new
 * `data:` URL — the `data:` token cannot occur inside a base64 payload (whose
 * alphabet excludes `:`), so this boundary is unambiguous for image posts.
 * Values that are already valid JSON arrays are left untouched (idempotent).
 */
export class ReencodePostImages1784133148233 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        const rows: Array<{ id: string; images: string | null }> =
            await queryRunner.query(
                `SELECT "id", "images" FROM "posts" WHERE "images" IS NOT NULL`,
            );

        for (const row of rows) {
            const raw = row.images;
            if (typeof raw !== "string") continue;

            // Empty string is how simple-array encoded an empty array. Left as
            // "", simple-json would choke on JSON.parse("") — convert to "[]".
            if (raw === "") {
                await queryRunner.query(
                    `UPDATE "posts" SET "images" = $1 WHERE "id" = $2`,
                    ["[]", row.id],
                );
                continue;
            }

            // Already migrated (valid JSON array) — leave as-is.
            if (raw.trimStart().startsWith("[")) {
                try {
                    JSON.parse(raw);
                    continue;
                } catch {
                    // Not actually valid JSON; fall through and re-encode.
                }
            }

            // Split the legacy comma-joined string back into individual URLs.
            // Only break before a new `data:` URL so the comma inside each data
            // URL's MIME prefix is preserved.
            const parts = raw.includes("data:")
                ? raw.split(/,(?=data:)/)
                : raw.split(",");

            const images = parts
                .map((p) => p.trim())
                .filter((p) => p.length > 0);

            await queryRunner.query(
                `UPDATE "posts" SET "images" = $1 WHERE "id" = $2`,
                [JSON.stringify(images), row.id],
            );
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Reverse: re-encode JSON arrays back to the legacy comma-joined format.
        const rows: Array<{ id: string; images: string | null }> =
            await queryRunner.query(
                `SELECT "id", "images" FROM "posts" WHERE "images" IS NOT NULL AND "images" <> ''`,
            );

        for (const row of rows) {
            const raw = row.images;
            if (raw === null || raw === "") continue;

            let images: string[];
            try {
                const parsed = JSON.parse(raw);
                if (!Array.isArray(parsed)) continue;
                images = parsed;
            } catch {
                // Not JSON — already in legacy format.
                continue;
            }

            await queryRunner.query(
                `UPDATE "posts" SET "images" = $1 WHERE "id" = $2`,
                [images.join(","), row.id],
            );
        }
    }

}
