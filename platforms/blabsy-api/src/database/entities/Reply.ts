import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, ManyToMany, JoinTable } from "typeorm";
import { User } from "./User";
import { Blab } from "./Blab";

@Entity("replies")
export class Reply {
    @PrimaryGeneratedColumn("uuid")
    id!: string;

    @ManyToOne(() => User, (user: User) => user.replies)
    creator!: User;

    @ManyToOne(() => Blab, (post: Blab) => post.replies)
    blab!: Blab;

    @Column("text")
    text!: string;

    @ManyToMany(() => User)
    @JoinTable({
        name: "reply_likes",
        joinColumn: { name: "replyt_id", referencedColumnName: "id" },
        inverseJoinColumn: { name: "user_id", referencedColumnName: "id" }
    })
    likedBy!: User[];

    @CreateDateColumn()
    createdAt!: Date;

    @UpdateDateColumn()
    updatedAt!: Date;

    @Column({ default: false })
    isArchived!: boolean;
} 