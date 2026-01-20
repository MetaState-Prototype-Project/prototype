import OpenAI from "openai";

export interface MatchResult {
    confidence: number;
    matchType: "private" | "group";
    reason: string;
    matchedWants: string[];
    matchedOffers: string[];
    suggestedActivities: string[];
    aiAnalysis: string;
}

export interface WishlistData {
    id: string;
    content: string;
    summaryWants: string[];
    summaryOffers: string[];
    userId: string;
    user: {
        id: string;
        name: string;
        ename: string;
    };
}

export class MatchingService {
    private openai: OpenAI;

    constructor() {
        this.openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY,
        });
    }

    /**
     * Analyze all possible pairs in parallel batches
     */
    async findMatches(wishlists: WishlistData[]): Promise<MatchResult[]> {
        console.log(`🤖 Starting AI matching process for ${wishlists.length} wishlists...`);
        
        const allMatches: MatchResult[] = [];
        const batchSize = 20; // Process 20 pairs at once
        const pairs: { wishlistA: WishlistData; wishlistB: WishlistData }[] = [];

        // Generate all possible pairs
        for (let i = 0; i < wishlists.length; i++) {
            for (let j = i + 1; j < wishlists.length; j++) {
                pairs.push({
                    wishlistA: wishlists[i],
                    wishlistB: wishlists[j]
                });
            }
        }

        console.log(`📊 Total pairs to analyze: ${pairs.length}`);

        // Process pairs in parallel batches
        for (let i = 0; i < pairs.length; i += batchSize) {
            const batch = pairs.slice(i, i + batchSize);
            console.log(`🔄 Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(pairs.length/batchSize)} (${batch.length} pairs)`);
            
            // Process all pairs in this batch in parallel
            const batchPromises = batch.map(async ({ wishlistA, wishlistB }) => {
                try {
                    const matchResult = await this.analyzeMatch(wishlistA, wishlistB);
                    if (matchResult.confidence > 0.85) {
                        return matchResult;
                    }
                    return null;
                } catch (error) {
                    console.error(`❌ Error analyzing match between ${wishlistA.user.name} and ${wishlistB.user.name}:`, error);
                    return null;
                }
            });

            const batchResults = await Promise.all(batchPromises);
            const validMatches = batchResults.filter(match => match !== null) as MatchResult[];
            allMatches.push(...validMatches);

            console.log(`✅ Batch completed: ${validMatches.length} matches found`);
            
            // Small delay between batches to be respectful to the API
            if (i + batchSize < pairs.length) {
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        }

        console.log(`🎉 AI matching process completed! Found ${allMatches.length} matches from ${pairs.length} comparisons`);
        return allMatches;
    }

    private buildAnalysisPrompt(wishlistA: WishlistData, wishlistB: WishlistData): string {
        const wantsA = (wishlistA.summaryWants || []).join(', ');
        const offersA = (wishlistA.summaryOffers || []).join(', ');
        const wantsB = (wishlistB.summaryWants || []).join(', ');
        const offersB = (wishlistB.summaryOffers || []).join(', ');
        
        return `
        Analyze these two wishlists to determine if there's a meaningful connection:
        
        Wishlist A (User: ${wishlistA.user.name}):
        Wants: ${wantsA || 'None specified'}
        Offers: ${offersA || 'None specified'}

        Wishlist B (User: ${wishlistB.user.name}):
        Wants: ${wantsB || 'None specified'}
        Offers: ${offersB || 'None specified'}

        IMPORTANT: Only return a JSON response if there's a meaningful connection (confidence > 0.85). If there's no meaningful connection, return confidence: 0 and matchType: "private" (this will be filtered out).

        CRITICAL: If either wishlist is blank, templated with minimal content, or contains insufficient information, return confidence: 0. A blank/templated wishlist has the template structure (## What I Want / ## What I Can Do) but with very few items (2 or fewer meaningful items) or very short/placeholder content. Do NOT generate matches based on generic or placeholder content.

        Return JSON with:
        1. "confidence": number between 0-1 indicating match strength (0 if no meaningful connection or if wishlists are too sparse)
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
        - Whether the wishlists contain sufficient meaningful content (not just template placeholders)
        
        Only suggest matches with confidence > 0.85 for meaningful connections based on substantial content.
                `.trim();
    }

    private async analyzeMatch(wishlistA: WishlistData, wishlistB: WishlistData): Promise<MatchResult> {
        const prompt = this.buildAnalysisPrompt(wishlistA, wishlistB);
        
        const response = await this.openai.chat.completions.create({
            model: "gpt-4",
            messages: [
                {
                    role: "system",
                    content: "You are an AI matching assistant. Your goal is to find meaningful connections between people based on their wishlists, identifying complementary needs and offerings. Provide a JSON response."
                },
                {
                    role: "user",
                    content: prompt,
                },
            ],
            // Remove response_format since it's not supported with this model
            temperature: 0.7,
        });

        const content = response.choices[0]?.message?.content;
        if (!content) {
            throw new Error("No response from OpenAI");
        }

        try {
            // Try to extract JSON from the response
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                throw new Error("No JSON found in response");
            }

            const analysis = JSON.parse(jsonMatch[0]);
            
            // Validate the response structure
            if (typeof analysis.confidence !== 'number' || 
                !['private', 'group'].includes(analysis.matchType)) {
                console.error("Invalid AI response structure:", analysis);
                throw new Error("Invalid response structure from OpenAI");
            }
            
            return {
                confidence: analysis.confidence || 0,
                matchType: analysis.matchType || "private",
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
}
