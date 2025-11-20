import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    ManyToOne,
    JoinColumn,
} from "typeorm";
import { User } from "./User";

@Entity("wishlists")
export class Wishlist {
    @PrimaryGeneratedColumn("uuid")
    id!: string;

    @Column({ type: "varchar", length: 255 })
    title!: string;

    @Column({ type: "text" })
    content!: string; // Markdown content

    @Column({ type: "boolean", default: true })
    isActive!: boolean;

    @Column({ type: "boolean", default: false })
    isPublic!: boolean;

    @Column({ type: "jsonb", nullable: true })
    metadata?: {
        tags?: string[];
        categories?: string[];
        lastAnalyzed?: Date;
        analysisVersion?: number;
    };

    @ManyToOne(() => User, (user) => user.wishlists, { onDelete: "CASCADE" })
    @JoinColumn({ name: "userId" })
    user!: User;

    @Column({ type: "uuid" })
    userId!: string;

    @CreateDateColumn()
    createdAt!: Date;

    @UpdateDateColumn()
    updatedAt!: Date;
}

