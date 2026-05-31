import {
    Column,
    CreateDateColumn,
    Entity,
    PrimaryGeneratedColumn,
    UpdateDateColumn,
} from "typeorm";

/**
 * Base cross-platform identity (User ontology, 550e8400-…-440000). Source of
 * truth locally; synced 2-way to/from every platform's eVault via the adapter.
 * `avatarUrl`/`bannerUrl` are public eVault-blob URLs. Always public
 * (`isPrivate` stays false) — base identity is never gated.
 */
@Entity("users")
export class User {
    @PrimaryGeneratedColumn("uuid")
    id!: string;

    @Column({ nullable: true, unique: true })
    ename!: string;

    @Column({ nullable: true })
    handle!: string;

    @Column({ nullable: true })
    name!: string;

    @Column({ nullable: true, type: "text" })
    bio!: string;

    @Column({ nullable: true })
    avatarUrl!: string;

    @Column({ nullable: true })
    bannerUrl!: string;

    @Column({ nullable: true })
    location!: string;

    @Column({ default: false })
    isVerified!: boolean;

    @Column({ default: false })
    isPrivate!: boolean;

    @Column({ default: false })
    isArchived!: boolean;

    @CreateDateColumn()
    createdAt!: Date;

    @UpdateDateColumn()
    updatedAt!: Date;
}
