import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, ManyToMany, JoinTable, OneToMany } from "typeorm";
import { User } from "./User";
import { Reply } from "./Reply";

@Entity("blabs")
export class Blab{
    @PrimaryGeneratedColumn("uuid")
    id!: string;

    @ManyToOne(() => User, (user: User) => user.blabs)
    author!: User;

    @Column({ type: "text" })
    content!: string; // was content

    @Column("simple-array", { nullable: true })
    images!: string[]; 

    @OneToMany(() => Reply, (comment: Reply) => comment.blab)
    replies!: Reply[];

    @ManyToMany(() => User)
    @JoinTable({
        name: "blab_likes",
        joinColumn: { name: "blab_id", referencedColumnName: "id" },
        inverseJoinColumn: { name: "user_id", referencedColumnName: "id" }
    })
    likedBy!: User[]; // was likes

    @Column("simple-array", { nullable: true })
    hashtags!: string[]; // was tags

    @CreateDateColumn()
    createdAt!: Date;

    @UpdateDateColumn()
    updatedAt!: Date;

    @Column({ default: false })
    isArchived!: boolean; // was isDeleted
} 