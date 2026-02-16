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

    @ManyToOne(() => User, { nullable: true })
    sender?: User; // Nullable for system messages

    @Column("text")
    text!: string;

    @ManyToOne(() => Chat, (e) => e.messages)
    chat!: Chat;

    @OneToMany(() => MessageReadStatus, (status) => status.message)
    readStatuses!: MessageReadStatus[];

    @Column({ default: false })
    isSystemMessage!: boolean; // Flag to identify system messages

    @CreateDateColumn()
    createdAt!: Date;

    @UpdateDateColumn()
    updatedAt!: Date;

    @Column({ default: false })
    isArchived!: boolean;
}
