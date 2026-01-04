import {
    Entity,
    CreateDateColumn,
    UpdateDateColumn,
    PrimaryGeneratedColumn,
    Column,
    ManyToMany,
    JoinTable,
} from "typeorm";
import { User } from "./User";

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

    @Column({ type: "text", nullable: true })
    charter!: string;

    @Column({ default: false })
    isPrivate!: boolean;

    @Column({ default: "public" })
    visibility!: "public" | "private" | "restricted";

    @ManyToMany(() => User)
    @JoinTable({
        name: "group_members",
        joinColumn: { name: "group_id", referencedColumnName: "id" },
        inverseJoinColumn: { name: "user_id", referencedColumnName: "id" }
    })
    members!: User[];

    @ManyToMany(() => User)
    @JoinTable({
        name: "group_admins",
        joinColumn: { name: "group_id", referencedColumnName: "id" },
        inverseJoinColumn: { name: "user_id", referencedColumnName: "id" }
    })
    admins!: User[];

    @ManyToMany(() => User)
    @JoinTable({
        name: "group_participants",
        joinColumn: { name: "group_id", referencedColumnName: "id" },
        inverseJoinColumn: { name: "user_id", referencedColumnName: "id" }
    })
    participants!: User[];

    @Column({ nullable: true })
    ename!: string;

    @Column({ nullable: true })
    avatarUrl!: string;

    @Column({ nullable: true })
    bannerUrl!: string;

    @CreateDateColumn()
    createdAt!: Date;

    @UpdateDateColumn()
    updatedAt!: Date;
}


