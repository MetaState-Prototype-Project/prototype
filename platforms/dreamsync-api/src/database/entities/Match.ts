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
import { Wishlist } from "./Wishlist";

export enum MatchType {
    PRIVATE = "private",
    GROUP = "group"
}

export enum MatchStatus {
    PENDING = "pending",
    ACCEPTED = "accepted",
    DECLINED = "declined",
    EXPIRED = "expired"
}

@Entity("matches")
export class Match {
    @PrimaryGeneratedColumn("uuid")
    id: string;

    @Column({ type: "enum", enum: MatchType })
    type: MatchType;

    @Column({ type: "enum", enum: MatchStatus, default: MatchStatus.PENDING })
    status: MatchStatus;

    @Column({ default: false })
    isActive: boolean; // Match is only active when both users consent

    @Column({ default: false })
    userAConsent: boolean; // User A has given consent

    @Column({ default: false })
    userBConsent: boolean; // User B has given consent

    @Column({ type: "text" })
    reason: string; // AI-generated explanation for the match

    @Column({ type: "jsonb" })
    matchData: {
        confidence: number; // 0-1 confidence score
        matchedWants: string[]; // What user A wants that user B can provide
        matchedOffers: string[]; // What user B offers that user A wants
        suggestedActivities?: string[];
        aiAnalysis?: string;
        activityCategory?: string; // Category of the activity (chess, youtube, etc.)
        allUserIds?: string[]; // All user IDs in this match (for multi-user matches)
        isMultiUserMatch?: boolean; // Flag to indicate this is part of a multi-user match
        userConsents?: { [userId: string]: boolean }; // Track consent for each user
        consentThreshold?: number; // Minimum number of users needed to consent (default: 2)
        newUserIds?: string[]; // Only new users who need to be added (for join existing group)
        existingGroupId?: string; // Reference to existing group (for join existing group)
        isJoinExistingGroup?: boolean; // Flag to indicate this is joining an existing group
        newUserId?: string; // The user who wants to join (for 2-user join existing group matches)
        adminUserId?: string; // The admin who needs to consent (for 2-user join existing group matches)
    };

    @ManyToOne(() => User, { onDelete: "CASCADE" })
    @JoinColumn({ name: "userAId" })
    userA: User;

    @Column({ type: "uuid" })
    userAId: string;

    @ManyToOne(() => User, { onDelete: "CASCADE" })
    @JoinColumn({ name: "userBId" })
    userB: User;

    @Column({ type: "uuid" })
    userBId: string;

    @ManyToOne(() => Wishlist, (wishlist) => wishlist.matches, { onDelete: "CASCADE" })
    @JoinColumn({ name: "wishlistId" })
    wishlist: Wishlist;

    @Column({ type: "uuid" })
    wishlistId: string;

    @Column({ type: "timestamp", nullable: true })
    expiresAt: Date;

    @Column({ type: "jsonb", nullable: true })
    metadata: {
        aiModel?: string;
        aiVersion?: string;
        processingTime?: number;
        previousMatches?: string[]; // IDs of previous matches between these users
    };

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}
