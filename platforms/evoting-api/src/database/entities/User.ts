import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    OneToMany,
} from "typeorm";
import { Poll } from "./Poll";
import { Vote } from "./Vote";

@Entity("users")
export class User {
    @PrimaryGeneratedColumn("uuid")
    id!: string;

    @Column({ nullable: true })
    handle!: string;

    @Column({ nullable: true })
    name!: string;

    @Column({ nullable: true })
    description!: string;

    @Column({ nullable: true })
    avatarUrl!: string;

    @Column({ nullable: true })
    bannerUrl!: string;

    @Column({ nullable: true })
    ename!: string;

    @Column({ default: false })
    isVerified!: boolean;

    @Column({ default: false })
    isPrivate!: boolean;

    @Column("varchar", { name: "email", length: 255, nullable: true })
    email!: string;

    @Column("boolean", { name: "emailVerified", default: false })
    emailVerified!: boolean;

    @OneToMany(() => Poll, (poll) => poll.creator)
    polls!: Poll[];

    @OneToMany(() => Vote, (vote) => vote.user)
    votes!: Vote[];

    @CreateDateColumn()
    createdAt!: Date;

    @UpdateDateColumn()
    updatedAt!: Date;

    @Column({ default: false })
    isArchived!: boolean;
}
