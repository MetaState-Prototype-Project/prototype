import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
} from "typeorm";

@Entity()
export class Verification {
    @PrimaryGeneratedColumn("uuid")
    id!: string;

    @Column({ type: "varchar", nullable: true })
    veriffId!: string;

    @Column({ type: "varchar", nullable: true })
    diditSessionId!: string;

    @Column({ type: "varchar", nullable: true })
    verificationUrl!: string;

    @Column({ type: "varchar", nullable: true })
    sessionToken!: string;

    @Column({ type: "boolean", nullable: true })
    approved!: boolean;

    @Column({ type: "jsonb", nullable: true })
    data!: Record<string, unknown>;

    @Column({ type: "varchar", nullable: true })
    referenceId!: string;

    @Column({ type: "varchar", nullable: true })
    documentId!: string;

    @Column({ type: "boolean", default: false })
    consumed!: boolean;

    @Column({ type: "varchar", nullable: true })
    linkedEName!: string;

    @Column({ type: "varchar", nullable: true })
    deviceId!: string;

    @Column({ type: "varchar", nullable: true })
    platform!: string;

    @Column({ type: "varchar", nullable: true })
    fcmToken!: string;

    @Column({ type: "boolean", default: true })
    deviceActive!: boolean;

    @CreateDateColumn()
    createdAt!: Date;

    @UpdateDateColumn()
    updatedAt!: Date;
}
