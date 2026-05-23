import {
    Column,
    CreateDateColumn,
    Entity,
    Index,
    PrimaryGeneratedColumn,
    UpdateDateColumn,
} from "typeorm";

@Entity("security_answer_attempt")
export class SecurityAnswerAttempt {
    @PrimaryGeneratedColumn("uuid")
    id!: string;

    @Index({ unique: true })
    @Column({ type: "varchar" })
    eName!: string;

    @Column({ type: "integer", default: 0 })
    failedCount!: number;

    @Column({ type: "timestamp", nullable: true })
    lockedUntil!: Date | null;

    @Column({ type: "timestamp", nullable: true })
    lastAttemptAt!: Date | null;

    @CreateDateColumn()
    createdAt!: Date;

    @UpdateDateColumn()
    updatedAt!: Date;
}
