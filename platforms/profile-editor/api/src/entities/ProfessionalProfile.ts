import {
    Column,
    CreateDateColumn,
    Entity,
    PrimaryGeneratedColumn,
    UpdateDateColumn,
} from "typeorm";
import type { Education, SocialLink, WorkExperience } from "../types/profile";

/**
 * Professional profile (Professional Profile ontology, 550e8400-…-440009).
 * Source of truth locally; synced 2-way with dreamsync via the adapter.
 * `isPublic` is the gate that travels with it. The shared fields match
 * dreamsync's mapping; workExperience/education/socialLinks/email/phone/website
 * are profile-editor-only (dreamsync ignores them).
 */
@Entity("professional_profiles")
export class ProfessionalProfile {
    @PrimaryGeneratedColumn("uuid")
    id!: string;

    @Column({ nullable: true, unique: true })
    ename!: string;

    @Column({ nullable: true })
    name!: string;

    @Column({ nullable: true })
    headline!: string;

    @Column({ nullable: true, type: "text" })
    bio!: string;

    @Column({ nullable: true })
    location!: string;

    @Column("text", { array: true, nullable: true })
    skills!: string[];

    @Column({ nullable: true })
    cvFileId!: string;

    @Column({ nullable: true })
    videoIntroFileId!: string;

    @Column({ default: false })
    isPublic!: boolean;

    @Column({ type: "jsonb", nullable: true })
    workExperience!: WorkExperience[];

    @Column({ type: "jsonb", nullable: true })
    education!: Education[];

    @Column({ type: "jsonb", nullable: true })
    socialLinks!: SocialLink[];

    @Column({ nullable: true })
    email!: string;

    @Column({ nullable: true })
    phone!: string;

    @Column({ nullable: true })
    website!: string;

    @CreateDateColumn()
    createdAt!: Date;

    @UpdateDateColumn()
    updatedAt!: Date;
}
