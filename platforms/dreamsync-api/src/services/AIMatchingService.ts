import OpenAI from "openai";
import { AppDataSource } from "../database/data-source";
import { Wishlist } from "../database/entities/Wishlist";
import { Match, MatchType, MatchStatus } from "../database/entities/Match";
import { Repository } from "typeorm";

export interface MatchResult {
    confidence: number;
    matchType: MatchType;
    reason: string;
    matchedWants: string[];
    matchedOffers: string[];
    suggestedActivities?: string[];
    aiAnalysis: string;
}

export class AIMatchingService {
    private openai: OpenAI;
    private wishlistRepository: Repository<Wishlist>;
    private matchRepository: Repository<Match>;

    constructor() {
        this.openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY,
        });
        this.wishlistRepository = AppDataSource.getRepository(Wishlist);
        this.matchRepository = AppDataSource.getRepository(Match);
    }

    async findMatches(): Promise<void> {
        console.log("🤖 Starting AI matching process...");
        
        const wishlists = await this.getWishlistsForMatching();
        console.log(`📋 Found ${wishlists.length} wishlists to analyze`);

        let totalMatches = 0;
        let totalProcessed = 0;
        const batchSize = 10; // Process in batches to avoid overwhelming the API

        for (let i = 0; i < wishlists.length; i += batchSize) {
            const batch = wishlists.slice(i, i + batchSize);
            console.log(`🔄 Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(wishlists.length/batchSize)} (${batch.length} wishlists)`);
            
            for (let j = 0; j < batch.length; j++) {
                for (let k = j + 1; k < batch.length; k++) {
                    const wishlistA = batch[j];
                    const wishlistB = batch[k];

                    // Skip if same user
                    if (wishlistA.userId === wishlistB.userId) continue;

                    // Check if match already exists
                    const existingMatch = await this.matchRepository.findOne({
                        where: [
                            { userAId: wishlistA.userId, userBId: wishlistB.userId },
                            { userAId: wishlistB.userId, userBId: wishlistA.userId }
                        ]
                    });

                    if (existingMatch) continue;

                    try {
                        const matchResult = await this.analyzeMatch(wishlistA, wishlistB);
                        
                        if (matchResult.confidence > 0.7) { // High confidence threshold
                            await this.createMatch(wishlistA, wishlistB, matchResult);
                            totalMatches++;
                            console.log(`✅ Created match ${totalMatches} between ${wishlistA.user.ename} and ${wishlistB.user.ename} (confidence: ${matchResult.confidence})`);
                        }
                    } catch (error) {
                        console.error(`❌ Error analyzing match between ${wishlistA.user.ename} and ${wishlistB.user.ename}:`, error);
                    }
                    
                    totalProcessed++;
                }
            }
            
            // Small delay between batches to be respectful to the API
            if (i + batchSize < wishlists.length) {
                await new Promise(resolve => setTimeout(resolve, 1000));
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

        console.log(`🎉 AI matching process completed! Created ${totalMatches} matches from ${totalProcessed} comparisons`);
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

    private async createMatch(wishlistA: Wishlist, wishlistB: Wishlist, matchResult: MatchResult): Promise<void> {
        const match = this.matchRepository.create({
            type: matchResult.matchType,
            status: MatchStatus.PENDING,
            reason: matchResult.reason,
            matchData: {
                confidence: matchResult.confidence,
                matchedWants: matchResult.matchedWants,
                matchedOffers: matchResult.matchedOffers,
                suggestedActivities: matchResult.suggestedActivities,
                aiAnalysis: matchResult.aiAnalysis
            },
            userAId: wishlistA.userId,
            userBId: wishlistB.userId,
            wishlistId: wishlistA.id,
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
            metadata: {
                aiModel: "gpt-4",
                aiVersion: "1.0",
                processingTime: Date.now()
            }
        });

        await this.matchRepository.save(match);
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
