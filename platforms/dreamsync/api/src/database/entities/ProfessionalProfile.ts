import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
} from "typeorm";

@Entity("professional_profiles")
export class ProfessionalProfile {
    @PrimaryGeneratedColumn("uuid")
    id!: string;

    @Column({ unique: true })
    ename!: string;

    @Column({ nullable: true })
    displayName!: string;

    @Column({ nullable: true })
    headline!: string;

    @Column({ type: "text", nullable: true })
    bio!: string;

    @Column({ nullable: true })
    avatarFileId!: string;

    @Column({ nullable: true })
    bannerFileId!: string;

    @Column({ nullable: true })
    cvFileId!: string;

    @Column({ nullable: true })
    videoIntroFileId!: string;

    @Column({ nullable: true })
    location!: string;

    @Column("text", { array: true, nullable: true })
    skills!: string[];

    @Column("jsonb", { nullable: true })
    workExperience!: object[];

    @Column("jsonb", { nullable: true })
    education!: object[];

    @Column({ default: true })
    isPublic!: boolean;

    @Column("jsonb", { nullable: true })
    socialLinks!: object[];

    @CreateDateColumn()
    createdAt!: Date;

    @UpdateDateColumn()
    updatedAt!: Date;
}
