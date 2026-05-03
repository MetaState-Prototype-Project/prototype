import {
    Column,
    CreateDateColumn,
    Entity,
    Index,
    PrimaryColumn,
} from "typeorm";

export type PacketOperation = "create" | "update" | "delete";

/**
 * A single awareness packet ingested from an eVault. `id` is the MetaEnvelope
 * id supplied by evault-core, so re-ingestion of the same envelope upserts.
 */
@Entity("packets")
@Index("idx_packets_ontology_received", ["ontology", "receivedAt"])
@Index("idx_packets_received_id", ["receivedAt", "id"])
export class Packet {
    @PrimaryColumn({ type: "varchar" })
    id!: string;

    /** The MetaEnvelope ontology / schema id (source payload `schemaId`). */
    @Index("idx_packets_ontology")
    @Column({ type: "varchar" })
    ontology!: string;

    @Index("idx_packets_evault_pubkey")
    @Column({ type: "varchar", nullable: true })
    evaultPublicKey!: string | null;

    /** The user's W3ID (eName) the envelope belongs to. */
    @Index("idx_packets_w3id")
    @Column({ type: "varchar", nullable: true })
    w3id!: string | null;

    @Column({ type: "jsonb", nullable: true })
    data!: Record<string, unknown> | null;

    @Column({ type: "varchar", default: "create" })
    operation!: PacketOperation;

    @Index("idx_packets_received")
    @Column({ type: "timestamptz", default: () => "now()" })
    receivedAt!: Date;

    @CreateDateColumn({ type: "timestamptz" })
    createdAt!: Date;
}
