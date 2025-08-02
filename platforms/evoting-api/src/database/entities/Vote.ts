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
    data:
        | string[] // normal
        | { option: string; points: number }[] // point
        | string[]; // rank

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}
