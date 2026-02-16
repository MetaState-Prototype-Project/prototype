import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    ManyToOne,
    JoinColumn,
} from "typeorm";
import { Group } from "./Group";
import { User } from "./User";

@Entity("charters")
export class Charter {
    @PrimaryGeneratedColumn("uuid")
    id!: string;

    @Column({ nullable: true })
    name!: string;

    @Column({ type: "text", nullable: true })
    content!: string; // This will store markdown content

    @Column({ default: false })
    isActive!: boolean;

    @Column({ nullable: true })
    groupId!: string;

    @ManyToOne(() => Group, { nullable: true })
    @JoinColumn({ name: "groupId" })
    group!: Group;

    @Column({ nullable: true })
    ownerId!: string;

    @ManyToOne(() => User)
    @JoinColumn({ name: "ownerId" })
    owner!: User;

    @CreateDateColumn()
    createdAt!: Date;

    @UpdateDateColumn()
    updatedAt!: Date;
} 