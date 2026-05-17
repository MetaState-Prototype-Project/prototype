import {
    Column,
    CreateDateColumn,
    Entity,
    Index,
    PrimaryGeneratedColumn,
} from "typeorm";

/**
 * A long-lived API key issued to an approved consumer. Only the SHA-256 hash is
 * stored; the plaintext key is shown to the consumer exactly once on creation.
 */
@Entity("api_keys")
export class ApiKey {
    @PrimaryGeneratedColumn("uuid")
    id!: string;

    @Index("idx_api_keys_consumer")
    @Column({ type: "uuid" })
    consumerId!: string;

    @Index("idx_api_keys_hash", { unique: true })
    @Column({ type: "varchar" })
    keyHash!: string;

    /** First chars of the plaintext key, for display in the portal. */
    @Column({ type: "varchar" })
    keyPrefix!: string;

    @Column({ type: "boolean", default: false })
    revoked!: boolean;

    @CreateDateColumn({ type: "timestamptz" })
    createdAt!: Date;

    @Column({ type: "timestamptz", nullable: true })
    lastUsedAt!: Date | null;
}
