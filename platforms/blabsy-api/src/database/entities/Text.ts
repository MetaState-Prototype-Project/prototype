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

@Entity("texts")
export class Text {
    @PrimaryGeneratedColumn("uuid")
    id!: string;

    @ManyToOne(() => User)
    author!: User;

    @Column({ type: "text" })
    content!: string;

    @ManyToOne(() => Chat, (e) => e.texts)
    chat!: Chat;

    @OneToMany(() => MessageReadStatus, (status) => status.text)
    readStatuses!: MessageReadStatus[];

    @CreateDateColumn()
    createdAt!: Date;

    @UpdateDateColumn()
    updatedAt!: Date;

    @Column({ default: false })
    isArchived!: boolean;
}
