import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    OneToMany,
    ManyToMany,
    JoinTable,
} from "typeorm";
import { Post } from "./Post";
import { Comment } from "./Comment";
import { Chat } from "./Chat";

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

    @OneToMany(() => Post, (post: Post) => post.author)
    posts!: Post[];

    @OneToMany(() => Comment, (comment: Comment) => comment.author)
    comments!: Comment[];

    @ManyToMany(() => User)
    @JoinTable({
        name: "user_followers",
        joinColumn: { name: "user_id", referencedColumnName: "id" },
        inverseJoinColumn: { name: "follower_id", referencedColumnName: "id" },
    })
    followers!: User[];

    @ManyToMany(() => User)
    @JoinTable({
        name: "user_following",
        joinColumn: { name: "user_id", referencedColumnName: "id" },
        inverseJoinColumn: { name: "following_id", referencedColumnName: "id" },
    })
    following!: User[];

    @ManyToMany(() => Chat, (chat) => chat.participants)
    chats!: Chat[];

    @CreateDateColumn()
    createdAt!: Date;

    @UpdateDateColumn()
    updatedAt!: Date;

    @Column({ default: false })
    isArchived!: boolean;
}
