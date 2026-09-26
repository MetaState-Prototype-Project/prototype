import type { MigrationInterface, QueryRunner } from "typeorm";

const INDEXES: Array<[name: string, definition: string]> = [
    [
        "idx_deliveries_expired_lease",
        `ON "deliveries" ("leaseExpiresAt", "createdAt", "id") WHERE status = 'delivering'`,
    ],
    [
        "idx_deliveries_active_created",
        `ON "deliveries" ("createdAt", "id") WHERE status IN ('pending', 'failed', 'delivering')`,
    ],
];

/**
 * Small partial indexes for expired-lease recovery and queue-age health, plus
 * worker-progress and first-attempt columns.
 *
 * `deliveries` holds millions of historical rows in production, so indexes are
 * built CONCURRENTLY (no write lock) outside a transaction and without the
 * application's statement timeout. Column additions are nullable or have a
 * constant default and are therefore metadata-only.
 */
export class DeliveryClaimIndexes1790000000000 implements MigrationInterface {
    name = "DeliveryClaimIndexes1790000000000";
    transaction = false;

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`SET statement_timeout = 0`);
        await queryRunner.query(`SET lock_timeout = '5s'`);
        try {
            await queryRunner.query(
                `ALTER TABLE "deliveries" ADD COLUMN IF NOT EXISTS "firstAttemptAt" timestamptz`,
            );
            await queryRunner.query(
                `ALTER TABLE "worker_heartbeats" ADD COLUMN IF NOT EXISTS "lastSuccessAt" timestamptz`,
            );
            await queryRunner.query(
                `ALTER TABLE "worker_heartbeats" ADD COLUMN IF NOT EXISTS "consecutiveFailures" integer NOT NULL DEFAULT 0`,
            );
            for (const [name, definition] of INDEXES) {
                // A failed concurrent build leaves an INVALID index behind that
                // IF NOT EXISTS would silently accept; drop it so a rerun rebuilds.
                const invalid = await queryRunner.query(
                    `SELECT 1 FROM pg_index i JOIN pg_class c ON c.oid = i.indexrelid
                     WHERE c.relname = $1 AND NOT i.indisvalid`,
                    [name],
                );
                if (invalid.length) {
                    await queryRunner.query(
                        `DROP INDEX CONCURRENTLY IF EXISTS "${name}"`,
                    );
                }
                await queryRunner.query(
                    `CREATE INDEX CONCURRENTLY IF NOT EXISTS "${name}" ${definition}`,
                );
            }
        } finally {
            await queryRunner.query(`RESET statement_timeout`);
            await queryRunner.query(`RESET lock_timeout`);
        }
    }

    // TypeORM always wraps a revert in a transaction, so CONCURRENTLY is
    // unavailable here; these partial indexes are small and drop quickly.
    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`SET lock_timeout = '5s'`);
        try {
            for (const [name] of INDEXES) {
                await queryRunner.query(`DROP INDEX IF EXISTS "${name}"`);
            }
            await queryRunner.query(
                `ALTER TABLE "worker_heartbeats" DROP COLUMN IF EXISTS "consecutiveFailures"`,
            );
            await queryRunner.query(
                `ALTER TABLE "worker_heartbeats" DROP COLUMN IF EXISTS "lastSuccessAt"`,
            );
            await queryRunner.query(
                `ALTER TABLE "deliveries" DROP COLUMN IF EXISTS "firstAttemptAt"`,
            );
        } finally {
            await queryRunner.query(`RESET lock_timeout`);
        }
    }
}
