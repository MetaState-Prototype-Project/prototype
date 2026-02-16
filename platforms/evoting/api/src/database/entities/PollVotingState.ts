import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    ManyToOne,
    JoinColumn
} from "typeorm";
import { Poll } from "./Poll";

@Entity("poll_voting_states")
export class PollVotingState {
    @PrimaryGeneratedColumn("uuid")
    id!: string;

    @Column()
    pollId!: string;

    @ManyToOne(() => Poll)
    @JoinColumn({ name: "pollId" })
    poll!: Poll;

    @Column("text", { array: true, default: [] })
    registeredVoters!: string[]; // Array of voter IDs

    @Column("jsonb", { nullable: true })
    voterAnchors!: any[]; // Store voter registration anchors

    @Column("jsonb", { nullable: true })
    commitments!: any[]; // Store vote commitments

    @Column("jsonb", { nullable: true })
    proofs!: any[]; // Store zero-knowledge proofs

    @CreateDateColumn()
    createdAt!: Date;

    @UpdateDateColumn()
    updatedAt!: Date;
} 