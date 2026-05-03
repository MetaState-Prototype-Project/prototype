import {
    Column,
    CreateDateColumn,
    Entity,
    Index,
    PrimaryGeneratedColumn,
} from "typeorm";

/**
 * A webhook subscription owned by a consumer. Empty filter arrays mean "match
 * everything". `isCatchAll` marks the backward-compat subscriptions seeded for
 * platforms that were registered before AaaS existed.
 */
@Entity("subscriptions")
export class Subscription {
    @PrimaryGeneratedColumn("uuid")
    id!: string;

    @Index("idx_subscriptions_consumer")
    @Column({ type: "uuid" })
    consumerId!: string;

    /** Where matching packets are POSTed. */
    @Column({ type: "varchar" })
    targetUrl!: string;

    /** Ontologies to match; empty = all ontologies. */
    @Column({ type: "text", array: true, default: () => "'{}'" })
    ontologyFilter!: string[];

    /** eVaults (w3id / evaultPublicKey) to match; empty = all eVaults. */
    @Column({ type: "text", array: true, default: () => "'{}'" })
    evaultFilter!: string[];

    @Column({ type: "boolean", default: false })
    isCatchAll!: boolean;

    @Column({ type: "boolean", default: true })
    active!: boolean;

    /** Optional shared secret; when set, payloads are signed with HMAC-SHA256. */
    @Column({ type: "varchar", nullable: true })
    secret!: string | null;

    @CreateDateColumn({ type: "timestamptz" })
    createdAt!: Date;
}
