import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    ManyToOne,
} from "typeorm";
import { User } from "./User";
import { Chat } from "./Chat";

@Entity("messages")
export class Message {
    @PrimaryGeneratedColumn("uuid")
    id!: string;

    @ManyToOne(() => User)
    sender!: User;

    @Column("text")
    text!: string;

    @Column({ default: false })
    isRead!: boolean;

    @ManyToOne(() => Chat, (e) => e.messages)
    chat!: Chat;

    @CreateDateColumn()
    createdAt!: Date;

    @UpdateDateColumn()
    updatedAt!: Date;

    @Column({ default: false })
    isArchived!: boolean;
}
