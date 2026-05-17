import {
    Column,
    CreateDateColumn,
    Entity,
    Index,
    PrimaryGeneratedColumn,
    Unique,
} from "typeorm";

export type DeliveryStatus =
    | "pending"
    | "delivering"
    | "delivered"
    | "failed"
    | "dead";

/**
 * A queued webhook delivery of one packet to one subscription. The unique
 * (subscriptionId, packetId) constraint makes ingest idempotent if evault-core
 * retries a POST.
 */
@Entity("deliveries")
@Unique("uq_delivery_subscription_packet", ["subscriptionId", "packetId"])
export class Delivery {
    @PrimaryGeneratedColumn("uuid")
    id!: string;

    @Index("idx_deliveries_subscription")
    @Column({ type: "uuid" })
    subscriptionId!: string;

    @Column({ type: "varchar" })
    packetId!: string;

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
}
