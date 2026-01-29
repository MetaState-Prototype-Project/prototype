import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    ManyToOne,
    JoinColumn,
    OneToMany,
} from "typeorm";
import { User } from "./User";
import { Match } from "./Match";

@Entity("wishlists")
export class Wishlist {
    @PrimaryGeneratedColumn("uuid")
    id: string;

    @Column({ type: "varchar", length: 255 })
    title: string;

    @Column({ type: "text" })
    content: string; // Markdown content

    @Column({ type: "jsonb", nullable: true })
    summaryWants: string[] | null;

    @Column({ type: "jsonb", nullable: true })
    summaryOffers: string[] | null;

    @Column({ type: "boolean", default: true })
    isActive: boolean;

    @Column({ type: "boolean", default: false })
    isPublic: boolean;

    @Column({ type: "jsonb", nullable: true })
    metadata: {
        tags?: string[];
        categories?: string[];
        lastAnalyzed?: Date;
        analysisVersion?: number;
    };

    @ManyToOne(() => User, (user) => user.wishlists, { onDelete: "CASCADE" })
    @JoinColumn({ name: "userId" })
    user: User;

    @Column({ type: "uuid" })
    userId: string;

    @OneToMany(() => Match, (match) => match.wishlist)
    matches: Match[];

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}
