import {
    Entity,
    CreateDateColumn,
    UpdateDateColumn,
    PrimaryGeneratedColumn,
    Column,
    OneToMany,
    ManyToMany,
    JoinTable,
} from "typeorm";
import { Message } from "./Message";
import { User } from "./User";

@Entity()
export class Chat {
    @PrimaryGeneratedColumn("uuid")
    id!: string;

    @Column({ nullable: true })
    name!: string;

    @OneToMany(() => Message, (e) => e.chat)
    messages!: Message[];

    @ManyToMany(() => User)
    @JoinTable({
        name: "chat_participants",
        joinColumn: { name: "chat_id", referencedColumnName: "id" },
        inverseJoinColumn: { name: "user_id", referencedColumnName: "id" }
    })
    participants!: User[];

    @CreateDateColumn()
    createdAt!: Date;

    @UpdateDateColumn()
    updatedAt!: Date;
}
