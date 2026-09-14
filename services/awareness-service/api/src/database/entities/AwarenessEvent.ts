import { Column, Entity, Index, PrimaryColumn } from "typeorm";
import type { PacketOperation } from "./Packet";

/**
 * Immutable awareness history. Packet remains the latest-state projection for
 * backwards-compatible point lookups; this table is the durable event log.
 */
@Entity("awareness_events")
@Index("idx_awareness_events_received_event", ["receivedAt", "eventId"])
@Index("idx_awareness_events_envelope_version", ["packetId", "streamVersion"])
@Index("idx_awareness_events_ontology_received", ["ontology", "receivedAt"])
export class AwarenessEvent {
    @PrimaryColumn({ type: "varchar" })
    eventId!: string;

    /** MetaEnvelope id from the wire payload. */
    @Index("idx_awareness_events_packet")
    @Column({ type: "varchar" })
    packetId!: string;

    @Column({ type: "varchar" })
    ontology!: string;

    @Column({ type: "varchar", nullable: true })
    evaultPublicKey!: string | null;

    @Column({ type: "varchar", nullable: true })
    w3id!: string | null;

    @Column({ type: "jsonb", nullable: true })
    data!: any;

    @Column({ type: "varchar", default: "create" })
    operation!: PacketOperation;

    @Column({ type: "bigint", nullable: true })
    streamVersion!: string | null;

    @Column({ type: "varchar", nullable: true })
    requestingPlatform!: string | null;

    @Column({ type: "timestamptz" })
    occurredAt!: Date;

    @Column({ type: "timestamptz", default: () => "now()" })
    receivedAt!: Date;
}
