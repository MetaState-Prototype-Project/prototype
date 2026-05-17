import {
    Column,
    CreateDateColumn,
    Entity,
    Index,
    PrimaryGeneratedColumn,
} from "typeorm";

/**
 * A delivery that exhausted all retry attempts. Surfaced in the admin portal;
 * an admin can replay it, which re-queues a fresh Delivery.
 */
@Entity("dead_letters")
export class DeadLetter {
    @PrimaryGeneratedColumn("uuid")
    id!: string;

    @Column({ type: "uuid" })
    deliveryId!: string;

    @Column({ type: "uuid" })
    subscriptionId!: string;

    @Column({ type: "varchar" })
    packetId!: string;

    @Column({ type: "uuid" })
    consumerId!: string;

    /** The exact body that failed to deliver. */
    @Column({ type: "jsonb" })
    payload!: any;

    @Column({ type: "varchar" })
    targetUrl!: string;

    @Column({ type: "int" })
    totalAttempts!: number;

    @Column({ type: "text", nullable: true })
    lastError!: string | null;

    @Column({ type: "int", nullable: true })
    lastResponseStatus!: number | null;

    @Index("idx_dead_letters_resolved")
    @Column({ type: "boolean", default: false })
    resolved!: boolean;

    @CreateDateColumn({ type: "timestamptz" })
    createdAt!: Date;
}
