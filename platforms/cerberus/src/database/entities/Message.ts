import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    ManyToOne,
} from "typeorm";
import { User } from "./User";
import { Group } from "./Group";

@Entity("messages")
export class Message {
    @PrimaryGeneratedColumn("uuid")
    id!: string;

    @ManyToOne(() => User)
    sender!: User;

    @Column("text")
    text!: string;

    @ManyToOne(() => Group, (group) => group.messages)
    group!: Group;

    @CreateDateColumn()
    createdAt!: Date;

    @UpdateDateColumn()
    updatedAt!: Date;

    @Column({ default: false })
    isArchived!: boolean;
} 