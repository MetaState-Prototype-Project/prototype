import {
    Column,
    CreateDateColumn,
    Entity,
    Index,
    PrimaryGeneratedColumn,
} from "typeorm";

export type ConsumerStatus = "pending" | "approved" | "rejected" | "revoked";

/**
 * A platform that consumes awareness packets. Created when a platform applies
 * for access via the portal, or auto-seeded for backward-compat catch-all.
 */
@Entity("consumers")
export class Consumer {
    @PrimaryGeneratedColumn("uuid")
    id!: string;

    @Index("idx_consumers_ename", { unique: true })
    @Column({ type: "varchar" })
    ename!: string;

    @Column({ type: "varchar", nullable: true })
    name!: string | null;

    @Column({ type: "varchar", nullable: true })
    contactEmail!: string | null;

    @Column({ type: "varchar", default: "pending" })
    status!: ConsumerStatus;

    /** Platform base URL; default webhook target is `<webhookBaseUrl>/api/webhook`. */
    @Column({ type: "varchar", nullable: true })
    webhookBaseUrl!: string | null;

    @CreateDateColumn({ type: "timestamptz" })
    createdAt!: Date;

    @Column({ type: "timestamptz", nullable: true })
    approvedAt!: Date | null;
}
