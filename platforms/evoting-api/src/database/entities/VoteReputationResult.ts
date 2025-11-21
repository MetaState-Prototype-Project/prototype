import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    ManyToOne,
    JoinColumn,
} from "typeorm";
import { Poll } from "./Poll";
import { Group } from "./Group";

export interface MemberReputation {
    ename: string;
    score: number;
    justification: string;
}

@Entity("vote_reputation_results")
export class VoteReputationResult {
    @PrimaryGeneratedColumn("uuid")
    id!: string;

    @ManyToOne(() => Poll)
    @JoinColumn({ name: "pollId" })
    poll!: Poll;

    @Column("uuid")
    pollId!: string;

    @ManyToOne(() => Group, { nullable: true })
    @JoinColumn({ name: "groupId" })
    group!: Group | null;

    @Column("uuid", { nullable: true })
    groupId!: string | null;

    /**
     * Array of reputation scores for each group member
     * Format: [{ ename: string, score: number, justification: string }]
     */
    @Column("jsonb")
    results!: MemberReputation[];

    @CreateDateColumn()
    createdAt!: Date;

    @UpdateDateColumn()
    updatedAt!: Date;
}

