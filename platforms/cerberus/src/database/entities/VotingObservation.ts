import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from "typeorm";
import { User } from "./User";

@Entity("voting_observations")
export class VotingObservation {
    @PrimaryGeneratedColumn("uuid")
    id!: string;

    @Column("uuid")
    groupId!: string;

    @Column("uuid", { nullable: true })
    owner!: string;

    @ManyToOne(() => User)
    @JoinColumn({ name: "owner" })
    ownerUser!: User;

    @Column("timestamp")
    lastCheckTime!: Date;

    @Column("timestamp", { nullable: true })
    lastVoteTime?: Date;

    @Column("integer", { nullable: true })
    requiredVoteInterval?: number; // in seconds

    @Column("integer")
    messagesAnalyzed!: number;

    @Column("timestamp")
    timeRangeStart!: Date;

    @Column("timestamp")
    timeRangeEnd!: Date;

    @Column("text")
    findings!: string;

    @CreateDateColumn()
    createdAt!: Date;

    @UpdateDateColumn()
    updatedAt!: Date;
} 