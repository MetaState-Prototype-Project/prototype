import {
    Column,
    CreateDateColumn,
    Entity,
    OneToMany,
    PrimaryGeneratedColumn,
    UpdateDateColumn,
} from "typeorm";
import { Vote } from "./Vote";

@Entity("poll")
export class Poll {
    @PrimaryGeneratedColumn("uuid")
    id: string;

    @Column("varchar", { length: 255 })
    title: string;

    @Column("enum", {
        enum: ["normal", "point", "rank"],
        default: "normal",
    })
    mode: "normal" | "point" | "rank";

    @Column("enum", {
        enum: ["public", "private"],
        default: "public",
    })
    visibility: "public" | "private";

    @Column("simple-array")
    options: string[]; // stored as comma-separated values

    @Column({ type: "timestamp", nullable: true })
    deadline: Date | null;

    @OneToMany(
        () => Vote,
        (vote) => vote.poll,
    )
    votes: Vote[];

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}
