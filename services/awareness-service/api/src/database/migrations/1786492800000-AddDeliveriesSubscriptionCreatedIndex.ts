import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Support `/api/me/deliveries`, which lists a consumer's most recent deliveries
 * newest-first. Without a (subscriptionId, createdAt) index that read sorts the
 * consumer's entire delivery history on every dashboard load; the existing
 * idx_deliveries_subscription can find the rows but cannot supply the ordering.
 *
 * NOTE for large deployments: `deliveries` is the hottest write table in the
 * service and a plain CREATE INDEX holds a SHARE lock - blocking the delivery
 * engine's writes - for as long as the build takes. Migrations here run inside
 * a single transaction (typeorm's default "all" mode), which rules out
 * CONCURRENTLY. So on a big table, build it by hand first:
 *
 *   CREATE INDEX CONCURRENTLY "idx_deliveries_subscription_created"
 *     ON "deliveries" ("subscriptionId", "createdAt" DESC);
 *
 * The IF NOT EXISTS below then makes this migration a no-op.
 */
export class AddDeliveriesSubscriptionCreatedIndex1786492800000
    implements MigrationInterface
{
    name = "AddDeliveriesSubscriptionCreatedIndex1786492800000";

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `CREATE INDEX IF NOT EXISTS "idx_deliveries_subscription_created"
             ON "deliveries" ("subscriptionId", "createdAt" DESC)`,
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `DROP INDEX IF EXISTS "idx_deliveries_subscription_created"`,
        );
    }
}
