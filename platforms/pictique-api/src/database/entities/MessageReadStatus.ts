import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    ManyToOne,
} from "typeorm";
import { Message } from "./Message";
import { User } from "./User";

@Entity("message_read_status")
export class MessageReadStatus {
    @PrimaryGeneratedColumn("uuid")
    id!: string;

    @ManyToOne(() => Message)
    message!: Message;

    @ManyToOne(() => User)
    user!: User;

    @Column({ default: false })
    isRead!: boolean;

    @CreateDateColumn()
    createdAt!: Date;

    @UpdateDateColumn()
    updatedAt!: Date;
} 