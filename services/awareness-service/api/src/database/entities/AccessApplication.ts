import {
    Column,
    CreateDateColumn,
    Entity,
    Index,
    PrimaryGeneratedColumn,
} from "typeorm";

export type ApplicationStatus = "pending" | "approved" | "rejected";

/**
 * An access request submitted by a platform through the portal. Reviewed by an
 * admin (eName in AAAS_ADMIN_ENAMES).
 */
@Entity("access_applications")
export class AccessApplication {
    @PrimaryGeneratedColumn("uuid")
    id!: string;

    @Index("idx_applications_consumer")
    @Column({ type: "uuid" })
    consumerId!: string;

    @Column({ type: "text", nullable: true })
    justification!: string | null;

    /** Ontologies the applicant says they need - informational only. */
    @Column({ type: "text", array: true, default: () => "'{}'" })
    requestedOntologies!: string[];

    @Column({ type: "varchar", default: "pending" })
    status!: ApplicationStatus;

    @Column({ type: "varchar", nullable: true })
    reviewedByEname!: string | null;

    @Column({ type: "text", nullable: true })
    reviewNote!: string | null;

    @CreateDateColumn({ type: "timestamptz" })
    createdAt!: Date;

    @Column({ type: "timestamptz", nullable: true })
    reviewedAt!: Date | null;
}
