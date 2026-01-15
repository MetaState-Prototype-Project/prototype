import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
} from "typeorm";

@Entity("users")
export class User {
    @PrimaryGeneratedColumn("uuid")
    id!: string;

    @Column({ nullable: true })
    handle!: string;

    @Column({ nullable: true })
    name!: string;

    @Column({ nullable: true })
    description!: string;

    @Column({ nullable: true })
    avatarUrl!: string;

    @Column({ nullable: true })
    bannerUrl!: string;

    @Column({ nullable: true })
    ename!: string;

    @Column({ default: false })
    isVerified!: boolean;

    @Column({ default: false })
    isPrivate!: boolean;

    @CreateDateColumn()
    createdAt!: Date;

    @UpdateDateColumn()
    updatedAt!: Date;

    @Column({ default: false })
    isArchived!: boolean;
}


