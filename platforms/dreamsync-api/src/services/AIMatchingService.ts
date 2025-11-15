import { AppDataSource } from "../database/data-source";
import { Wishlist } from "../database/entities/Wishlist";
import { Match, MatchType, MatchStatus } from "../database/entities/Match";
import { Group } from "../database/entities/Group";
import { Repository } from "typeorm";
import { MatchNotificationService } from "./MatchNotificationService";
import { MatchingService, MatchResult, WishlistData, GroupData } from "./MatchingService";
import { withOperationContext } from "../context/OperationContext";
import OpenAI from "openai";

export class AIMatchingService {
    private matchingService: MatchingService;
    private wishlistRepository: Repository<Wishlist>;
    private matchRepository: Repository<Match>;
    private groupRepository: Repository<Group>;
    private notificationService: MatchNotificationService;
    private openai: OpenAI;

    constructor() {
        this.matchingService = new MatchingService();
        this.wishlistRepository = AppDataSource.getRepository(Wishlist);
        this.matchRepository = AppDataSource.getRepository(Match);
        this.groupRepository = AppDataSource.getRepository(Group);
        this.notificationService = new MatchNotificationService();
        this.openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY,
        });
    }

    async findMatches(): Promise<void> {
        console.log("🤖 Starting AI matching process...");
        
        // Generate unique operation ID for this matching process
        const operationId = `ai-matching-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        
        return withOperationContext('AIMatchingService', operationId, async () => {
            const wishlists = await this.getWishlistsForMatching();
            console.log(`📋 Found ${wishlists.length} wishlists to analyze`);

            // Get existing groups for context
            const existingGroups = await this.getExistingGroups();
            console.log(`🏠 Found ${existingGroups.length} existing groups to consider`);

            // Convert to shared service format
            const wishlistData: WishlistData[] = wishlists.map(wishlist => ({
                id: wishlist.id,
                content: wishlist.content,
                userId: wishlist.userId,
                user: {
                    id: wishlist.user.id,
                    name: wishlist.user.name || wishlist.user.ename,
                    ename: wishlist.user.ename
                }
            }));

            // Use matching service for parallel processing
            const matchResults = await this.matchingService.findMatches(wishlistData, existingGroups);

            // Create database matches from results
            let totalMatches = 0;
            for (const matchResult of matchResults) {
                // Find the original wishlists for all users in the match
                const matchWishlists = matchResult.userIds.map(userId => 
                    wishlists.find(w => w.userId === userId)
                ).filter(Boolean) as Wishlist[];

                if (matchWishlists.length !== matchResult.userIds.length) {
                    console.log(`❌ Could not find all wishlists for match: ${matchResult.userIds.join(', ')}`);
                    continue;
                }

                // Check if match already exists (any combination of these users)
                // Skip this check for JOIN_EXISTING_GROUP matches since they're joining existing groups
                const isJoinExistingGroup = matchResult.suggestedActivities?.some((activity: any) => 
                    typeof activity === 'string' && activity.startsWith('JOIN_EXISTING_GROUP:')
                );
                
            if (!isJoinExistingGroup) {
                const existingMatch = await this.checkForExistingMatch(matchResult.userIds, matchResult.activityCategory);
                if (existingMatch) {
                    continue;
                }
            }
            
            // Handle JOIN_EXISTING_GROUP matches differently
            if (isJoinExistingGroup) {
                const groupId = matchResult.suggestedActivities?.find((activity: any) => 
                    typeof activity === 'string' && activity.startsWith('JOIN_EXISTING_GROUP:')
                )?.split(':')[1];
                
                if (groupId) {
                    await this.handleJoinExistingGroupMatch(matchWishlists, matchResult, groupId);
                    totalMatches++;
                }
            } else {
                await this.createMatch(matchWishlists, matchResult);
                totalMatches++;
            }
            }

            // Mark wishlists as analyzed
            for (const wishlist of wishlists) {
                await this.wishlistRepository.update(wishlist.id, {
                    metadata: {
                        ...wishlist.metadata,
                        lastAnalyzed: new Date(),
                        analysisVersion: (wishlist.metadata?.analysisVersion || 1) + 1
                    }
                });
            }

            console.log(`🎉 AI matching process completed! Created ${totalMatches} matches from ${matchResults.length} AI results`);
            
            // Process any existing matches that haven't been messaged yet
            await this.processUnmessagedMatches();
        });
    }

    /**
     * Find and process matches that haven't been messaged yet
     */
    async processUnmessagedMatches(): Promise<void> {
        try {
            console.log("📨 Checking for unmessaged matches...");
            
            // Get all matches that haven't been messaged yet
            const unmessagedMatches = await this.getUnmessagedMatches();
            
            if (unmessagedMatches.length === 0) {
                console.log("✅ No unmessaged matches found");
                return;
            }
            
            console.log(`📨 Found ${unmessagedMatches.length} unmessaged matches, processing notifications...`);
            
            let processedCount = 0;
            for (const match of unmessagedMatches) {
                try {
                    await this.notificationService.processMatch(match);
                    processedCount++;
                    console.log(`✅ Processed notification for match: ${match.id} (${processedCount}/${unmessagedMatches.length})`);
                } catch (error) {
                    console.error(`❌ Error processing notification for match ${match.id}:`, error);
                }
            }
            
            console.log(`🎉 Processed ${processedCount} unmessaged match notifications`);
        } catch (error) {
            console.error("Error processing unmessaged matches:", error);
        }
    }

    /**
     * Get all matches that haven't been messaged yet
     */
    private async getUnmessagedMatches(): Promise<Match[]> {
        try {
            const dreamsyncUser = await this.notificationService.findDreamSyncUser();
            if (!dreamsyncUser) {
                console.error("Cannot check unmessaged matches: DreamSync user not found");
                return [];
            }

            // Get all matches
            const allMatches = await this.matchRepository.find({
                relations: ["userA", "userB"],
                order: { createdAt: "DESC" }
            });

            // Filter out matches that have already been messaged
            const unmessagedMatches: Match[] = [];
            
            for (const match of allMatches) {
                const hasBeenMessaged = await this.notificationService.hasNotificationBeenSent(match);
                if (!hasBeenMessaged) {
                    unmessagedMatches.push(match);
                }
            }

            return unmessagedMatches;
        } catch (error) {
            console.error("Error getting unmessaged matches:", error);
            return [];
        }
    }

    private async getWishlistsForMatching(): Promise<Wishlist[]> {
        return await this.wishlistRepository
            .createQueryBuilder("wishlist")
            .leftJoinAndSelect("wishlist.user", "user")
            .where("wishlist.isActive = :isActive", { isActive: true })
            .andWhere("user.isPrivate = :isPrivate", { isPrivate: false })
            .orderBy("wishlist.updatedAt", "DESC")
            .limit(200) // Increased limit for more matches
            .getMany();
    }

    private async getExistingGroups(): Promise<GroupData[]> {
        const groups = await this.groupRepository
            .createQueryBuilder("group")
            .leftJoinAndSelect("group.members", "members")
            .where("group.isPrivate = :isPrivate", { isPrivate: false })
            .andWhere("group.name ILIKE :dreamsync", { dreamsync: "%DreamSync%" })
            .orderBy("group.createdAt", "DESC")
            .limit(50) // Limit to recent groups
            .getMany();

        return groups.map(group => ({
            id: group.id,
            name: group.name,
            description: group.description || "",
            activityCategory: this.extractActivityCategory(group.name),
            memberCount: group.members?.length || 0,
            memberIds: group.members?.map(m => m.id) || [],
            createdAt: group.createdAt
        }));
    }

    private extractActivityCategory(groupName: string): string {
        const name = groupName.toLowerCase();
        if (name.includes('chess')) return 'chess';
        if (name.includes('youtube')) return 'youtube';
        if (name.includes('language')) return 'language-exchange';
        if (name.includes('fitness') || name.includes('gym')) return 'fitness';
        if (name.includes('coding') || name.includes('programming')) return 'coding';
        if (name.includes('photography')) return 'photography';
        if (name.includes('music')) return 'music';
        if (name.includes('cooking') || name.includes('food')) return 'cooking';
        return 'general';
    }

    private async checkForExistingMatch(userIds: string[], activityCategory: string): Promise<Match | null> {
        console.log(`🔍 Checking for existing match with activity: ${activityCategory} for users: ${userIds.join(', ')}`);
        
        // Check if any pair of users already have a match for the SAME activity
        for (let i = 0; i < userIds.length; i++) {
            for (let j = i + 1; j < userIds.length; j++) {
                const existingMatches = await this.matchRepository.find({
                    where: [
                        { userAId: userIds[i], userBId: userIds[j] },
                        { userAId: userIds[j], userBId: userIds[i] }
                    ],
                    relations: ["userA", "userB"]
                });
                
                // Check if any existing match has the same activity category
                for (const match of existingMatches) {
                    const matchActivity = this.extractActivityFromMatch(match);
                    console.log(`🔍 Found existing match ${match.id} with activity: ${matchActivity}`);
                    
                    if (matchActivity.toLowerCase() === activityCategory.toLowerCase()) {
                        console.log(`⏭️ Found existing match for SAME activity: ${activityCategory}`);
                        return match;
                    }
                }
            }
        }
        
        console.log(`✅ No existing match found for activity: ${activityCategory}`);
        return null;
    }

    /**
     * Extract activity from existing match data
     */
    private extractActivityFromMatch(match: Match): string {
        // Try to extract from matchData.activityCategory first
        if (match.matchData?.activityCategory) {
            return match.matchData.activityCategory;
        }
        
        // Fallback to extracting from suggested activities
        const activities = match.matchData?.suggestedActivities || [];
        if (activities.length > 0) {
            const firstActivity = activities[0].toLowerCase();
            if (firstActivity.includes('chess')) return 'chess';
            if (firstActivity.includes('youtube')) return 'youtube';
            if (firstActivity.includes('language')) return 'language-exchange';
            if (firstActivity.includes('driving')) return 'driving-lessons';
            if (firstActivity.includes('cube')) return 'cube-puzzles';
            if (firstActivity.includes('fitness') || firstActivity.includes('gym')) return 'fitness';
            if (firstActivity.includes('coding') || firstActivity.includes('programming')) return 'coding';
            if (firstActivity.includes('photography')) return 'photography';
            if (firstActivity.includes('music')) return 'music';
            if (firstActivity.includes('cooking') || firstActivity.includes('food')) return 'cooking';
        }
        
        // Fallback to extracting from reason
        const reason = match.reason?.toLowerCase() || '';
        if (reason.includes('chess')) return 'chess';
        if (reason.includes('youtube')) return 'youtube';
        if (reason.includes('language')) return 'language-exchange';
        if (reason.includes('driving')) return 'driving-lessons';
        if (reason.includes('cube')) return 'cube-puzzles';
        if (reason.includes('fitness') || reason.includes('gym')) return 'fitness';
        if (reason.includes('coding') || reason.includes('programming')) return 'coding';
        if (reason.includes('photography')) return 'photography';
        if (reason.includes('music')) return 'music';
        if (reason.includes('cooking') || reason.includes('food')) return 'cooking';
        
        return 'general';
    }

    private async analyzeMatch(wishlistA: Wishlist, wishlistB: Wishlist): Promise<MatchResult> {
        const prompt = this.buildAnalysisPrompt(wishlistA, wishlistB);
        
        const response = await this.openai.chat.completions.create({
            model: "gpt-5-mini",
            messages: [
                {
                    role: "system",
                    content: "You are an AI assistant that analyzes wishlists to find meaningful connections between people. You should identify what one person wants that another can offer, and vice versa. Consider both private 1-on-1 connections and group activities. Return your analysis in JSON format."
                },
                {
                    role: "user",
                    content: prompt
                }
            ],
            temperature: 0.3,
            max_tokens: 1000
        });

        const content = response.choices[0]?.message?.content;
        if (!content) {
            throw new Error("No response from OpenAI");
        }

        try {
            const analysis = JSON.parse(content);
            
            // Validate the response structure
            if (typeof analysis.confidence !== 'number' || 
                !['private', 'group'].includes(analysis.matchType)) {
                console.error("Invalid AI response structure:", analysis);
                throw new Error("Invalid response structure from OpenAI");
            }
            
            return {
                confidence: analysis.confidence || 0,
                matchType: analysis.matchType || MatchType.PRIVATE,
                reason: analysis.reason || "",
                matchedWants: analysis.matchedWants || [],
                matchedOffers: analysis.matchedOffers || [],
                suggestedActivities: analysis.suggestedActivities || [],
                aiAnalysis: analysis.aiAnalysis || "",
                userIds: [wishlistA.userId, wishlistB.userId],
                activityCategory: analysis.activityCategory || "general"
            };
        } catch (error) {
            console.error("Failed to parse OpenAI response:", content);
            console.error("Parse error:", error);
            throw new Error("Invalid response format from OpenAI");
        }
    }

    private buildAnalysisPrompt(wishlistA: Wishlist, wishlistB: Wishlist): string {
        return `
Analyze these two wishlists to determine if there's a meaningful connection:

**User A (${wishlistA.user.ename}):**
Title: ${wishlistA.title}
Content: ${wishlistA.content}

**User B (${wishlistB.user.ename}):**
Title: ${wishlistB.title}
Content: ${wishlistB.content}

IMPORTANT: Only return a JSON response if there's a meaningful connection (confidence > 0.7). If there's no meaningful connection, return confidence: 0 and matchType: "private" (this will be filtered out).

Return JSON with:
1. "confidence": number between 0-1 indicating match strength (0 if no meaningful connection)
2. "matchType": "private" or "group" (use "private" if no connection)
3. "reason": brief explanation of why they match (or why no match)
4. "matchedWants": array of what User A wants that User B can offer
5. "matchedOffers": array of what User B offers that User A wants
6. "suggestedActivities": array of specific activities they could do together
7. "aiAnalysis": detailed analysis of the connection

Consider:
- Skills, interests, and goals alignment
- Complementary needs and offerings
- Potential for meaningful collaboration
- Whether this could be a private connection or group activity

Only suggest matches with confidence > 0.7 for meaningful connections.
        `.trim();
    }

    private async createMatch(wishlists: Wishlist[], matchResult: MatchResult): Promise<void> {
        console.log(`🔄 createMatch called for ${matchResult.userIds.length} users: ${matchResult.userIds.join(', ')}`);
        
        // For multi-user matches, create a single match record with all users
        if (matchResult.userIds.length > 2) {
            console.log(`🔄 Creating multi-user match for ${matchResult.userIds.length} users`);
            await this.createMultiUserMatch(wishlists, matchResult);
            return;
        }
        
        // For 2-user matches, use the existing logic
        const wishlistA = wishlists[0];
        const wishlistB = wishlists[1];
        
        const match = this.matchRepository.create({
            type: matchResult.matchType as MatchType,
            status: MatchStatus.PENDING,
            reason: matchResult.reason,
            matchData: {
                confidence: matchResult.confidence,
                matchedWants: matchResult.matchedWants,
                matchedOffers: matchResult.matchedOffers,
                suggestedActivities: matchResult.suggestedActivities,
                aiAnalysis: matchResult.aiAnalysis,
                activityCategory: matchResult.activityCategory,
                allUserIds: matchResult.userIds,
                isMultiUserMatch: false,
                userConsents: {},
                consentThreshold: 2
            },
            userAId: wishlistA.userId,
            userBId: wishlistB.userId,
            wishlistId: wishlistA.id,
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
            metadata: {
                aiModel: "gpt-5-mini",
                aiVersion: "1.0",
                processingTime: Date.now()
            }
        });

        const savedMatch = await this.matchRepository.save(match);
        console.log(`✅ Saved match: ${savedMatch.id} for users: ${matchResult.userIds.join(', ')}`);
        
        // Load the match with user relations for notification processing
        const matchWithRelations = await this.matchRepository.findOne({
            where: { id: savedMatch.id },
            relations: ["userA", "userB"]
        });
        
        if (!matchWithRelations) {
            console.error("Failed to load match with relations:", savedMatch.id);
            return;
        }
        
        // Send notifications to both users
        try {
            await this.notificationService.processMatch(matchWithRelations);
        } catch (error) {
            console.error("Error sending match notifications:", error);
            // Don't fail the match creation if notifications fail
        }
    }

    private async createMultiUserMatch(wishlists: Wishlist[], matchResult: MatchResult): Promise<void> {
        console.log(`🔄 createMultiUserMatch called for ${matchResult.userIds.length} users: ${matchResult.userIds.join(', ')}`);
        
        // Check if AI suggests joining an existing group
        const joinExistingGroupSuggestion = matchResult.suggestedActivities?.find(activity => 
            activity.startsWith('JOIN_EXISTING_GROUP:')
        );
        
        if (joinExistingGroupSuggestion) {
            console.log(`🏠 AI suggests joining existing group: ${joinExistingGroupSuggestion}`);
            const groupId = joinExistingGroupSuggestion.replace('JOIN_EXISTING_GROUP:', '');
            await this.handleJoinExistingGroupMatch(wishlists, matchResult, groupId);
            return;
        }
        
        // For multi-user matches, create a single match record with all users
        const userIds = matchResult.userIds;
        const wishlistA = wishlists[0]; // Use first user as primary
        const wishlistB = wishlists[1]; // Use second user as secondary (for compatibility)
        
        // Initialize consent tracking for all users
        const userConsents: { [userId: string]: boolean } = {};
        userIds.forEach(userId => {
            userConsents[userId] = false;
        });
        
        const match = this.matchRepository.create({
            type: matchResult.matchType as MatchType,
            status: MatchStatus.PENDING,
            reason: matchResult.reason,
            matchData: {
                confidence: matchResult.confidence,
                matchedWants: matchResult.matchedWants,
                matchedOffers: matchResult.matchedOffers,
                suggestedActivities: matchResult.suggestedActivities,
                aiAnalysis: matchResult.aiAnalysis,
                activityCategory: matchResult.activityCategory,
                allUserIds: userIds,
                isMultiUserMatch: true,
                userConsents: userConsents,
                consentThreshold: Math.max(2, Math.ceil(userIds.length / 2)) // At least 2, or half the users
            },
            userAId: wishlistA.userId,
            userBId: wishlistB.userId,
            wishlistId: wishlistA.id,
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
            metadata: {
                aiModel: "gpt-5-mini",
                aiVersion: "1.0",
                processingTime: Date.now()
            }
        });

        const savedMatch = await this.matchRepository.save(match);
        console.log(`✅ Created multi-user ${matchResult.matchType} match for ${userIds.length} users: ${savedMatch.id}`);
        console.log(`👥 Users: ${userIds.join(', ')}`);
        console.log(`🎯 Consent threshold: ${match.matchData.consentThreshold}`);
        
        // Load the match with user relations for notification processing
        const matchWithRelations = await this.matchRepository.findOne({
            where: { id: savedMatch.id },
            relations: ["userA", "userB"]
        });
        
        if (!matchWithRelations) {
            console.error("Failed to load multi-user match with relations:", savedMatch.id);
            return;
        }
        
        // Send notifications to all users
        try {
            await this.notificationService.processMatch(matchWithRelations);
        } catch (error) {
            console.error("Error sending multi-user match notifications:", error);
            // Don't fail the match creation if notifications fail
        }
    }

    /**
     * Handle multi-user match where AI suggests joining an existing group
     * Creates individual 2-user matches between each new user and the group admin
     */
    private async handleJoinExistingGroupMatch(wishlists: Wishlist[], matchResult: MatchResult, groupId: string): Promise<void> {
        try {
            // Get the existing group
            const groupRepository = AppDataSource.getRepository(Group);
            const existingGroup = await groupRepository.findOne({
                where: { id: groupId },
                relations: ["members", "admins"]
            });
            
            if (!existingGroup) {
                // Fall back to creating a new match
                await this.createMultiUserMatch(wishlists, matchResult);
                return;
            }
            
            // Check which users are already members
            const userIds = matchResult.userIds;
            const existingMemberIds = existingGroup.members?.map(member => member.id) || [];
            const newUserIds = userIds.filter(userId => !existingMemberIds.includes(userId));
            
            if (newUserIds.length === 0) {
                return;
            }
            
            // Get the group admin (first admin)
            const adminId = existingGroup.admins?.[0]?.id;
            if (!adminId) {
                return;
            }
            
            // Create individual 2-user matches between each new user and the admin
            for (const newUserId of newUserIds) {
                await this.createJoinExistingGroupMatch(newUserId, adminId, groupId, matchResult);
            }
            
        } catch (error) {
            console.error("Error handling join existing group match:", error);
            // Fall back to creating a new match
            await this.createMultiUserMatch(wishlists, matchResult);
        }
    }
    
    /**
     * Create a 2-user match for joining an existing group
     */
    private async createJoinExistingGroupMatch(newUserId: string, adminId: string, groupId: string, matchResult: MatchResult): Promise<void> {
        try {
            // Find the new user's wishlist for this activity
            const newUserWishlist = await this.wishlistRepository.findOne({
                where: { userId: newUserId },
                relations: ["user"]
            });
            
            if (!newUserWishlist) {
                return;
            }
            
            const match = this.matchRepository.create({
                type: MatchType.GROUP, // Group activity
                status: MatchStatus.PENDING,
                reason: `User wants to join existing group for ${matchResult.activityCategory}`,
                matchData: {
                    confidence: matchResult.confidence,
                    matchedWants: matchResult.matchedWants,
                    matchedOffers: matchResult.matchedOffers,
                    suggestedActivities: matchResult.suggestedActivities,
                    aiAnalysis: matchResult.aiAnalysis,
                    activityCategory: matchResult.activityCategory,
                    existingGroupId: groupId, // Reference to existing group
                    isJoinExistingGroup: true, // Flag to indicate this is joining existing group
                    newUserId: newUserId, // The user who wants to join
                    adminUserId: adminId // The admin who needs to consent
                },
                userAId: newUserId, // New user
                userBId: adminId, // Admin
                wishlistId: newUserWishlist.id, // Reference to the new user's wishlist
                expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
                metadata: {
                    aiModel: "gpt-5-mini",
                    aiVersion: "1.0",
                    processingTime: Date.now()
                }
            });
    
            const savedMatch = await this.matchRepository.save(match);
            
            // Load the match with user relations for notification processing
            const matchWithRelations = await this.matchRepository.findOne({
                where: { id: savedMatch.id },
                relations: ["userA", "userB"]
            });
            
            if (!matchWithRelations) {
                return;
            }
            
            // Send notifications to both users (new user and admin)
            try {
                await this.notificationService.processMatch(matchWithRelations);
            } catch (error) {
                console.error("Error sending join existing group match notifications:", error);
                // Don't fail the match creation if notifications fail
            }
            
        } catch (error) {
            console.error("Error creating join existing group match:", error);
        }
    }

    async getMatchesForUser(userId: string): Promise<Match[]> {
        return await this.matchRepository.find({
            where: [
                { userAId: userId },
                { userBId: userId }
            ],
            relations: ["userA", "userB", "wishlist"],
            order: { createdAt: "DESC" }
        });
    }

    async updateMatchStatus(matchId: string, userId: string, status: MatchStatus): Promise<Match> {
        const match = await this.matchRepository.findOne({
            where: [
                { id: matchId, userAId: userId },
                { id: matchId, userBId: userId }
            ]
        });

        if (!match) {
            throw new Error("Match not found or access denied");
        }

        match.status = status;
        return await this.matchRepository.save(match);
    }

    async getMatchingStats(): Promise<{
        totalWishlists: number;
        totalMatches: number;
        activeMatches: number;
        pendingMatches: number;
        acceptedMatches: number;
        declinedMatches: number;
    }> {
        const totalWishlists = await this.wishlistRepository.count({
            where: { isActive: true }
        });

        const totalMatches = await this.matchRepository.count();
        const activeMatches = await this.matchRepository.count({
            where: { status: MatchStatus.PENDING }
        });
        const pendingMatches = await this.matchRepository.count({
            where: { status: MatchStatus.PENDING }
        });
        const acceptedMatches = await this.matchRepository.count({
            where: { status: MatchStatus.ACCEPTED }
        });
        const declinedMatches = await this.matchRepository.count({
            where: { status: MatchStatus.DECLINED }
        });

        return {
            totalWishlists,
            totalMatches,
            activeMatches,
            pendingMatches,
            acceptedMatches,
            declinedMatches
        };
    }
}
