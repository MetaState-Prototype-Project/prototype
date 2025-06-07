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
import { User } from "./User";
import { Text } from "./Text";

@Entity()
export class Chat {
    @PrimaryGeneratedColumn("uuid")
    id!: string;

    @Column({ nullable: true })
    chatName!: string;

    @OneToMany(() => Text, (e) => e.chat)
    texts!: Text[];

    @ManyToMany(() => User)
    @JoinTable({
        name: "chat_participants",
        joinColumn: { name: "chat_id", referencedColumnName: "id" },
        inverseJoinColumn: { name: "user_id", referencedColumnName: "id" }
    })
    users!: User[];

    @CreateDateColumn()
    createdAt!: Date;

    @UpdateDateColumn()
    updatedAt!: Date;
}
