import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from "typeorm";

@Entity("voting_observations")
export class VotingObservation {
    @PrimaryGeneratedColumn("uuid")
    id!: string;

    @Column("uuid")
    groupId!: string;

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