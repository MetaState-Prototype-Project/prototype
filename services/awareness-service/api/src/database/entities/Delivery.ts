import {
    Column,
    CreateDateColumn,
    Entity,
    Index,
    PrimaryGeneratedColumn,
} from "typeorm";

export type DeliveryStatus =
    | "pending"
    | "delivering"
    | "delivered"
    | "failed"
    | "dead";

/**
 * A queued webhook delivery of one immutable event to one subscription.
 */
@Entity("deliveries")
@Index("uq_delivery_subscription_event", ["subscriptionId", "eventId"], {
    unique: true,
})
// Serves the consumer dashboard's newest-first delivery list.
@Index("idx_deliveries_subscription_created", ["subscriptionId", "createdAt"])
@Index(
    "idx_deliveries_active_stream_order",
    ["subscriptionId", "packetId", "createdAt", "id"],
    { where: `"status" IN ('pending', 'failed', 'delivering')` },
)
@Index("idx_deliveries_claim_due", ["nextAttemptAt", "createdAt", "id"], {
    where: `"status" IN ('pending', 'failed')`,
})
@Index(
    "idx_deliveries_expired_lease",
    ["leaseExpiresAt", "createdAt", "id"],
    { where: `"status" = 'delivering'` },
)
// Serves queue-age health without scanning delivered/dead history.
@Index("idx_deliveries_active_created", ["createdAt", "id"], {
    where: `"status" IN ('pending', 'failed', 'delivering')`,
})
export class Delivery {
    @PrimaryGeneratedColumn("uuid")
    id!: string;

    @Index("idx_deliveries_subscription")
    @Column({ type: "uuid" })
    subscriptionId!: string;

    @Column({ type: "varchar" })
    packetId!: string;

    /** Immutable source event id. Legacy rows are backfilled during migration. */
    @Index("idx_deliveries_event")
    @Column({ type: "varchar" })
    eventId!: string;

    /** SHA-256 audit fingerprint of the exact payload at ingest. */
    @Column({ type: "varchar" })
    contentHash!: string;

    /** Immutable event snapshot; prevents later packet upserts changing this delivery. */
    @Column({ type: "jsonb", nullable: true })
    // `any` avoids TypeORM DeepPartial rejecting arbitrary JSON object values.
    payload!: any;

    @Column({ type: "varchar", default: "pending" })
    status!: DeliveryStatus;

    @Column({ type: "int", default: 0 })
    attempts!: number;

    @Index("idx_deliveries_next_attempt")
    @Column({ type: "timestamptz", default: () => "now()" })
    nextAttemptAt!: Date;

    @Column({ type: "text", nullable: true })
    lastError!: string | null;

    @Column({ type: "int", nullable: true })
    lastResponseStatus!: number | null;

    @CreateDateColumn({ type: "timestamptz" })
    createdAt!: Date;

    @Column({ type: "timestamptz", nullable: true })
    deliveredAt!: Date | null;

    /**
     * Set at ingest and reset by admin replay. The automatic retry window is
     * `deliveryRetryWindowMs` from the later of this and `firstAttemptAt`, so
     * time spent waiting in the queue never consumes the retry budget.
     */
    @Column({ type: "timestamptz", default: () => "now()" })
    retryStartedAt!: Date;

    /** When a worker first claimed this delivery; null until then. */
    @Column({ type: "timestamptz", nullable: true })
    firstAttemptAt!: Date | null;

    /** Token-fenced lease; stale workers cannot complete a reclaimed row. */
    @Column({ type: "varchar", nullable: true })
    leaseOwner!: string | null;

    @Column({ type: "uuid", nullable: true })
    leaseToken!: string | null;

    @Index("idx_deliveries_lease_expires")
    @Column({ type: "timestamptz", nullable: true })
    leaseExpiresAt!: Date | null;
}
