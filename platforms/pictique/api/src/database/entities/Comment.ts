import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, ManyToMany, JoinTable } from "typeorm";
import { User } from "./User";
import { Post } from "./Post";

@Entity("comments")
export class Comment {
    @PrimaryGeneratedColumn("uuid")
    id!: string;

    @ManyToOne(() => User, (user: User) => user.comments)
    author!: User;

    @ManyToOne(() => Post, (post: Post) => post.comments)
    post!: Post;

    @Column("text")
    text!: string;

    @ManyToMany(() => User)
    @JoinTable({
        name: "comment_likes",
        joinColumn: { name: "comment_id", referencedColumnName: "id" },
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