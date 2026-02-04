import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
} from "typeorm";

export enum MigrationStatus {
    INITIATED = "initiated",
    PROVISIONING = "provisioning",
    COPYING = "copying",
    VERIFYING = "verifying",
    UPDATING_REGISTRY = "updating_registry",
    MARKING_ACTIVE = "marking_active",
    COMPLETED = "completed",
    FAILED = "failed",
}

@Entity("evault_migrations")
export class Migration {
    @PrimaryGeneratedColumn("uuid")
    id!: string;

    @Column("uuid")
    userId!: string;

    @Column({ nullable: true })
    oldEvaultId!: string;

    @Column({ nullable: true })
    newEvaultId!: string;

    /** Provisioner-created w3id registered with Registry; used for cleanup on failure. */
    @Column({ nullable: true })
    newW3id!: string;

    @Column({ nullable: true })
    eName!: string;

    @Column({ nullable: true })
    oldEvaultUri!: string;

    @Column({ nullable: true })
    newEvaultUri!: string;

    @Column({ nullable: true })
    provisionerUrl!: string;

    @Column({
        type: "enum",
        enum: MigrationStatus,
        default: MigrationStatus.INITIATED,
    })
    status!: MigrationStatus;

    @Column("text", { nullable: true })
    logs!: string;

    @Column("text", { nullable: true })
    error!: string;

    @CreateDateColumn()
    createdAt!: Date;

    @UpdateDateColumn()
    updatedAt!: Date;
}

