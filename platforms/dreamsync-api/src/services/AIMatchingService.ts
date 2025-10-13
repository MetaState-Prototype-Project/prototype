import { AppDataSource } from "../database/data-source";
import { Wishlist } from "../database/entities/Wishlist";
import { Match, MatchType, MatchStatus } from "../database/entities/Match";
import { Group } from "../database/entities/Group";
import { Repository } from "typeorm";
import { MatchNotificationService } from "./MatchNotificationService";
import { MatchingService, MatchResult, WishlistData, GroupData } from "./MatchingService";

export class AIMatchingService {
    private matchingService: MatchingService;
    private wishlistRepository: Repository<Wishlist>;
    private matchRepository: Repository<Match>;
    private groupRepository: Repository<Group>;
    private notificationService: MatchNotificationService;

    constructor() {
        this.matchingService = new MatchingService();
        this.wishlistRepository = AppDataSource.getRepository(Wishlist);
        this.matchRepository = AppDataSource.getRepository(Match);
        this.groupRepository = AppDataSource.getRepository(Group);
        this.notificationService = new MatchNotificationService();
    }

    async findMatches(): Promise<void> {
        console.log("🤖 Starting AI matching process...");
        
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
            // Check if this is a "join existing group" suggestion
            const joinGroupActivity = matchResult.suggestedActivities.find(activity => 
                activity.startsWith('JOIN_EXISTING_GROUP:')
            );
            
            if (joinGroupActivity) {
                const groupId = joinGroupActivity.split(':')[1];
                console.log(`🏠 AI suggests users join existing group: ${groupId}`);
                // Handle joining existing group (implement this logic)
                continue;
            }

            // Find the original wishlists for all users in the match
            const matchWishlists = matchResult.userIds.map(userId => 
                wishlists.find(w => w.userId === userId)
            ).filter(Boolean) as Wishlist[];

            if (matchWishlists.length !== matchResult.userIds.length) {
                console.log(`❌ Could not find all wishlists for match: ${matchResult.userIds.join(', ')}`);
                continue;
            }

            // Check if match already exists (any combination of these users)
            const existingMatch = await this.checkForExistingMatch(matchResult.userIds);
            if (existingMatch) {
                console.log(`⏭️ Match already exists for users: ${matchResult.userIds.join(', ')}`);
                continue;
            }

            await this.createMatch(matchWishlists, matchResult);
            totalMatches++;
            const userNames = matchWishlists.map(w => w.user.ename).join(', ');
            console.log(`✅ Created ${matchResult.matchType} match ${totalMatches} for ${userNames} (confidence: ${matchResult.confidence})`);
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

    private async checkForExistingMatch(userIds: string[]): Promise<Match | null> {
        // For now, check if any pair of users already have a match
        // In the future, we could check for exact group matches
        for (let i = 0; i < userIds.length; i++) {
            for (let j = i + 1; j < userIds.length; j++) {
                const existingMatch = await this.matchRepository.findOne({
                    where: [
                        { userAId: userIds[i], userBId: userIds[j] },
                        { userAId: userIds[j], userBId: userIds[i] }
                    ]
                });
                if (existingMatch) return existingMatch;
            }
        }
        return null;
    }

    private async analyzeMatch(wishlistA: Wishlist, wishlistB: Wishlist): Promise<MatchResult> {
        const prompt = this.buildAnalysisPrompt(wishlistA, wishlistB);
        
        const response = await this.openai.chat.completions.create({
            model: "gpt-4",
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
                aiAnalysis: analysis.aiAnalysis || ""
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
        // For now, create a match between the first two users
        // In the future, we could create group matches differently
        const wishlistA = wishlists[0];
        const wishlistB = wishlists[1];
        
        const match = this.matchRepository.create({
            type: matchResult.matchType,
            status: MatchStatus.PENDING,
            reason: matchResult.reason,
            matchData: {
                confidence: matchResult.confidence,
                matchedWants: matchResult.matchedWants,
                matchedOffers: matchResult.matchedOffers,
                suggestedActivities: matchResult.suggestedActivities,
                aiAnalysis: matchResult.aiAnalysis,
                activityCategory: matchResult.activityCategory,
                userIds: matchResult.userIds
            },
            userAId: wishlistA.userId,
            userBId: wishlistB.userId,
            wishlistId: wishlistA.id,
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
            metadata: {
                aiModel: "gpt-4",
                aiVersion: "1.0",
                processingTime: Date.now(),
                allUserIds: matchResult.userIds // Store all user IDs for group matches
            }
        });

        const savedMatch = await this.matchRepository.save(match);
        
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
