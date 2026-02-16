import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from "typeorm";

@Entity("webhook_processing")
@Index(["webhookId"], { unique: true }) // Prevent duplicate processing using unique webhook ID
export class WebhookProcessing {
    @PrimaryGeneratedColumn("uuid")
    id!: string;

    @Column({ type: "varchar", length: 255 })
    webhookId!: string; // Unique identifier for this specific webhook event

    @Column({ type: "varchar", length: 255 })
    globalId!: string; // The global ID from the webhook (entity ID)

    @Column({ type: "varchar", length: 255 })
    schemaId!: string; // The schema ID from the webhook

    @Column({ type: "varchar", length: 100 })
    tableName!: string; // users, groups, messages, etc.

    @Column({ type: "varchar", length: 50, default: "pending" })
    status!: "pending" | "processing" | "completed" | "failed";

    @Column({ type: "text", nullable: true })
    errorMessage?: string;

    @Column({ type: "uuid", nullable: true })
    localId?: string; // The local ID created/updated

    @Column({ type: "jsonb", nullable: true })
    webhookData?: any; // Store the full webhook data for debugging

    @CreateDateColumn()
    createdAt!: Date;

    @Column({ type: "timestamp", nullable: true })
    completedAt?: Date;
}
