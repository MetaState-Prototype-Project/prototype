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
import { Blab} from "./Blab";
import { Reply} from "./Reply";
import { Chat } from "./Chat";

@Entity("users")
export class User {
    @PrimaryGeneratedColumn("uuid")
    id!: string;

    @Column({ nullable: true })
    username!: string;

    @Column({ nullable: true })
    displayName!: string;

    @Column({ nullable: true })
    bio!: string;

    @Column({ nullable: true })
    profilePictureUrl!: string;

    @Column({ nullable: true })
    bannerUrl!: string;

    @Column({ nullable: true })
    ename!: string;

    @Column({ default: false })
    isVerified!: boolean;

    @Column({ default: false })
    isPrivate!: boolean;

    @OneToMany(() => Blab, (post: Blab) => post.author)
    blabs!: Blab[];

    @OneToMany(() => Reply, (reply: Reply) => reply.creator)
    replies!: Reply[];

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

    @ManyToMany(() => Chat, (chat) => chat.users)
    chats!: Chat[];

    @CreateDateColumn()
    createdAt!: Date;

    @UpdateDateColumn()
    updatedAt!: Date;

    @Column({ default: false })
    isArchived!: boolean;
}
