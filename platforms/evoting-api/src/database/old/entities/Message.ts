import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    ManyToOne,
    OneToMany,
} from "typeorm";
import { User } from "./User";
import { Chat } from "./Chat";
import { MessageReadStatus } from "./MessageReadStatus";

@Entity("messages")
export class Message {
    @PrimaryGeneratedColumn("uuid")
    id!: string;

    @ManyToOne(() => User)
    sender!: User;

    @Column("text")
    text!: string;

    @ManyToOne(() => Chat, (e) => e.messages)
    chat!: Chat;

    @OneToMany(() => MessageReadStatus, (status) => status.message)
    readStatuses!: MessageReadStatus[];

    @CreateDateColumn()
    createdAt!: Date;

    @UpdateDateColumn()
    updatedAt!: Date;

    @Column({ default: false })
    isArchived!: boolean;
}
