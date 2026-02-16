import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, ManyToMany, JoinTable, OneToMany } from "typeorm";
import { User } from "./User";
import { Comment } from "./Comment";

@Entity("posts")
export class Post {
    @PrimaryGeneratedColumn("uuid")
    id!: string;

    @ManyToOne(() => User, (user: User) => user.posts)
    author!: User;

    @Column("text")
    text!: string; // was content

    @Column("simple-array", { nullable: true })
    images!: string[]; // was mediaUrls

    @OneToMany(() => Comment, (comment: Comment) => comment.post)
    comments!: Comment[];

    @ManyToMany(() => User)
    @JoinTable({
        name: "post_likes",
        joinColumn: { name: "post_id", referencedColumnName: "id" },
        inverseJoinColumn: { name: "user_id", referencedColumnName: "id" }
    })
    likedBy!: User[]; // was likes

    @Column("simple-array", { nullable: true })
    hashtags!: string[]; // was tags

    @CreateDateColumn()
    createdAt!: Date;

    @UpdateDateColumn()
    updatedAt!: Date;

    @Column({ default: false })
    isArchived!: boolean; // was isDeleted
} 