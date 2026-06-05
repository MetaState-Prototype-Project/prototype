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
    ename!: string | null;

    @Column({ nullable: true })
    name!: string | null;

    @Column({ nullable: true })
    headline!: string | null;

    @Column({ nullable: true, type: "text" })
    bio!: string | null;

    @Column({ nullable: true })
    location!: string | null;

    @Column("text", { array: true, nullable: true })
    skills!: string[] | null;

    @Column({ nullable: true })
    cvFileId!: string | null;

    @Column({ nullable: true })
    videoIntroFileId!: string | null;

    @Column({ default: false })
    isPublic!: boolean;

    @Column({ type: "jsonb", nullable: true })
    workExperience!: WorkExperience[] | null;

    @Column({ type: "jsonb", nullable: true })
    education!: Education[] | null;

    @Column({ type: "jsonb", nullable: true })
    socialLinks!: SocialLink[] | null;

    @Column({ nullable: true })
    email!: string | null;

    @Column({ nullable: true })
    phone!: string | null;

    @Column({ nullable: true })
    website!: string | null;

    @CreateDateColumn()
    createdAt!: Date;

    @UpdateDateColumn()
    updatedAt!: Date;
}
