import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn } from "typeorm";
import { User } from "./User";

@Entity("references")
export class Reference {
    @PrimaryGeneratedColumn("uuid")
    id!: string;

    @Column()
    targetType!: string; // "user", "group", "platform"

    @Column()
    targetId!: string;

    @Column()
    targetName!: string;

    @Column("text")
    content!: string;

    @Column()
    referenceType!: string; // "general", "professional", etc.

    @Column("int", { nullable: true })
    numericScore?: number; // Optional 1-5 score

    @Column()
    authorId!: string;

    @ManyToOne(() => User)
    @JoinColumn({ name: "authorId" })
    author!: User;

    @Column({ nullable: true })
    status!: string; // "signed", "revoked"

    @CreateDateColumn()
    createdAt!: Date;

    @UpdateDateColumn()
    updatedAt!: Date;
}
