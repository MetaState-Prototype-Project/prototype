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

    // Number of rows loaded per keyset-paginated batch. Kept modest because
    // each image payload can be a multi-MB base64 data URL.
    private static readonly BATCH_SIZE = 200;

    public async up(queryRunner: QueryRunner): Promise<void> {
        const batchSize = ReencodePostImages1784133148233.BATCH_SIZE;
        // Keyset cursor: the all-zero UUID is the lower bound, so `id > cursor`
        // starts from the first row. Paging by id (never by the mutated
        // `images` column) means re-encoded rows can't reappear in a later
        // batch, so the walk always terminates.
        let cursor = "00000000-0000-0000-0000-000000000000";
        let batch: Array<{ id: string; images: string | null }>;

        do {
            batch = await queryRunner.query(
                `SELECT "id", "images" FROM "posts"
                 WHERE "images" IS NOT NULL AND "id" > $1
                 ORDER BY "id" ASC
                 LIMIT $2`,
                [cursor, batchSize],
            );
            if (batch.length === 0) break;
            cursor = batch[batch.length - 1].id;

            const updates: Array<{ id: string; images: string }> = [];
            for (const row of batch) {
                if (typeof row.images !== "string") continue;
                const reencoded = this.reencode(row.images);
                // `undefined` = already valid JSON, no write needed.
                if (reencoded !== undefined) {
                    updates.push({ id: row.id, images: reencoded });
                }
            }

            if (updates.length > 0) {
                // Single bulk UPDATE per batch via a VALUES join, instead of
                // one round-trip per row.
                const valuesSql = updates
                    .map((_, i) => `($${i * 2 + 1}::uuid, $${i * 2 + 2}::text)`)
                    .join(", ");
                const params = updates.flatMap((u) => [u.id, u.images]);
                await queryRunner.query(
                    `UPDATE "posts" AS p
                     SET "images" = v.images
                     FROM (VALUES ${valuesSql}) AS v(id, images)
                     WHERE p."id" = v.id`,
                    params,
                );
            }
        } while (batch.length === batchSize);
    }

    /**
     * Convert a single legacy `images` value to its `simple-json` encoding.
     * Returns the new string to store, or `undefined` when the value is already
     * a valid JSON array and should be left untouched.
     */
    private reencode(raw: string): string | undefined {
        // Empty string is how simple-array encoded an empty array. Left as "",
        // simple-json would choke on JSON.parse("") — convert to "[]".
        if (raw === "") return "[]";

        // Already migrated (valid JSON array) — leave as-is.
        if (raw.trimStart().startsWith("[")) {
            try {
                JSON.parse(raw);
                return undefined;
            } catch {
                // Not actually valid JSON; fall through and re-encode.
            }
        }

        // Reconstruct the array from the legacy comma-joined string.
        // Walk comma-separated tokens: a base64 data URL got split across two
        // tokens ("data:<mime>;base64" + "<payload>") by the comma in its own
        // prefix, so rejoin that pair. Any other value (e.g. a Firebase/HTTP
        // download URL) contains no internal comma and stands alone. This
        // recovers pure-data, pure-URL, and mixed posts in any order.
        const tokens = raw.split(",");
        const images: string[] = [];
        for (let i = 0; i < tokens.length; i++) {
            const token = tokens[i].trim();
            if (token === "") continue;

            if (token.startsWith("data:")) {
                const payload = (tokens[i + 1] ?? "").trim();
                images.push(payload ? `${token},${payload}` : token);
                i++; // consume the payload token
            } else {
                images.push(token);
            }
        }

        return JSON.stringify(images);
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
