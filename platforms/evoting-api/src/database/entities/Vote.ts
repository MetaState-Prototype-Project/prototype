import {
    Column,
    CreateDateColumn,
    Entity,
    JoinColumn,
    ManyToOne,
    PrimaryGeneratedColumn,
    UpdateDateColumn,
} from "typeorm";
import { Poll } from "./Poll";

export type NormalVoteData = string[];

export type PointVoteData = {
    option: string;
    points: number;
}[];

export type RankVoteData = {
    option: string;
    points: number; // 1 = top pick, 2 = next, etc.
}[];

export type VoteData = NormalVoteData | PointVoteData | RankVoteData;

export type VoteDataByMode =
    | { mode: "normal"; data: NormalVoteData }
    | { mode: "point"; data: PointVoteData }
    | { mode: "rank"; data: RankVoteData };

@Entity("vote")
export class Vote {
    @PrimaryGeneratedColumn("uuid")
    id: string;

    @ManyToOne(
        () => Poll,
        (poll) => poll.votes,
        { onDelete: "CASCADE" },
    )
    @JoinColumn({ name: "pollId" })
    poll: Poll;

    @Column("uuid")
    pollId: string;

    // This can be user ID, session ID, or anonymous identifier
    @Column("varchar", { length: 255 })
    voterId: string;

    /**
     * For "normal" mode: array of chosen options (usually 1)
     * For "point" mode: { option: string, points: number }[]
     * For "rank" mode: ordered array of option strings
     *
     * Stored as JSON for flexibility
     */
    @Column("jsonb")
    data: VoteDataByMode;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}
