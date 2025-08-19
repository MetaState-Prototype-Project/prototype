import {
    Entity,
    CreateDateColumn,
    UpdateDateColumn,
    PrimaryGeneratedColumn,
    Column,
    ManyToMany,
    JoinTable,
    OneToMany,
} from "typeorm";
import { Message } from "./Message";
import { CharterSignature } from "./CharterSignature";

@Entity()
export class Group {
    @PrimaryGeneratedColumn("uuid")
    id!: string;

    @Column({ nullable: true })
    name!: string;

    @Column({ nullable: true })
    description!: string;

    @Column({ nullable: true })
    owner!: string;

    @Column("simple-array", { nullable: true })
    admins!: string[];

    @Column({ type: "text", nullable: true })
    charter!: string; // Markdown content for the group charter

    @Column({ default: true })
    isCharterActive!: boolean; // Whether the charter is currently active and monitoring violations

    @ManyToMany("User")
    @JoinTable({
        name: "group_participants",
        joinColumn: { name: "group_id", referencedColumnName: "id" },
        inverseJoinColumn: { name: "user_id", referencedColumnName: "id" }
    })
    participants!: any[];

    @OneToMany(() => Message, (message) => message.group)
    messages!: Message[];

    @OneToMany(() => CharterSignature, (signature) => signature.group)
    charterSignatures!: CharterSignature[];

    @CreateDateColumn()
    createdAt!: Date;

    @UpdateDateColumn()
    updatedAt!: Date;
} 