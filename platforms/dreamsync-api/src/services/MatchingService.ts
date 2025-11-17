import OpenAI from "openai";

export interface MatchResult {
    confidence: number;
    matchType: "private" | "group";
    reason: string;
    matchedWants: string[];
    matchedOffers: string[];
    suggestedActivities: string[];
    aiAnalysis: string;
    userIds: string[]; // Array of user IDs (2+ for groups, 2 for private)
    activityCategory: string; // e.g., "chess", "youtube", "language-exchange", "fitness"
}

export interface WishlistData {
    id: string;
    content: string;
    userId: string;
    user: {
        id: string;
        name: string;
        ename: string;
    };
}

export interface GroupData {
    id: string;
    name: string;
    description: string;
    activityCategory: string;
    memberCount: number;
    memberIds: string[];
    createdAt: Date;
}

export class MatchingService {
    private openai: OpenAI;

    constructor() {
        this.openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY,
        });
    }

    /**
     * Analyze all wishlists at once and find matches in a single AI request
     */
    async findMatches(wishlists: WishlistData[], existingGroups?: GroupData[]): Promise<MatchResult[]> {
        console.log(`🤖 Starting AI matching process for ${wishlists.length} wishlists...`);
        console.log(`📊 Analyzing all wishlists in a single AI request (much more efficient!)`);
        
        if (existingGroups && existingGroups.length > 0) {
            console.log(`🏠 Found ${existingGroups.length} existing groups to consider`);
        }

        try {
            const matchResults = await this.analyzeAllMatches(wishlists, existingGroups);
            console.log(`🎉 AI matching process completed! Found ${matchResults.length} matches`);
            return matchResults;
        } catch (error) {
            console.error("❌ Error in AI matching process:", error);
            return [];
        }
    }

    private buildAllMatchesPrompt(wishlists: WishlistData[], existingGroups?: GroupData[]): string {
        const wishlistTexts = wishlists.map((wishlist, index) => 
            `Wishlist ${index + 1} (User: ${wishlist.user.name}, ID: ${wishlist.userId}):
${wishlist.content}
    
---`
        ).join('\n\n');

        let existingGroupsText = '';
        if (existingGroups && existingGroups.length > 0) {
            const groupsText = existingGroups.map((group, index) => 
                `Existing Group ${index + 1}:
- Name: ${group.name}
- Activity: ${group.activityCategory}
- Members: ${group.memberCount} people
- Description: ${group.description}
- Created: ${group.createdAt.toISOString().split('T')[0]}
- Group ID: ${group.id}
    
---`
            ).join('\n\n');
            
            existingGroupsText = `

EXISTING GROUPS TO CONSIDER:
${groupsText}

IMPORTANT: If users match an existing group's activity, suggest they JOIN that group instead of creating a new one!
Use the format: "JOIN_EXISTING_GROUP:${existingGroups[0].id}" in the suggestedActivities field.

This applies even if the user is NOT currently a member of the group - they can still join existing groups for the same activity.

However, if users want to collaborate on a DIFFERENT activity than existing groups, create a NEW group for that specific activity.
`;
        }

        return `
You are an AI matching assistant. Analyze ALL the wishlists below and find meaningful connections between users.

${wishlistTexts}${existingGroupsText}

TASK: Find ALL meaningful matches between these users based on their wishlists.

IMPORTANT RULES:
1. Only suggest matches with confidence > 0.7
2. Each user can be matched with multiple other users
3. Return ALL matches found, not just the best ones
4. Consider both "What I Want" and "What I Can Do" sections
5. Support GROUP activities with 3+ people and PRIVATE activities with 2 people
6. Classify activities properly:
   - PRIVATE: Personal services (tutoring, coaching, 1-on-1 lessons, personal projects)
   - GROUP: Group activities (sports teams, clubs, workshops, group projects, tournaments)

Return a JSON array of matches with this structure:
[
  {
    "userIds": ["user-001", "user-002", "user-020"], 
    "confidence": 0.85,
    "matchType": "group",
    "activityCategory": "activity-name",
    "reason": "Description of why these users match",
    "matchedWants": ["what users want"],
    "matchedOffers": ["what users can provide"],
    "suggestedActivities": ["suggested activities"],
    "aiAnalysis": "AI analysis of the match"
  }
]

Find as many meaningful matches as possible. Look for:
- Complementary skills (one teaches, one learns)
- Shared interests and activities  
- Group activities that 3+ people can join
- Private 1-on-1 services
- Skill exchanges and collaborations
- Learning partnerships

GROUP ACTIVITIES (3+ people): Group activities, clubs, workshops, tournaments, group projects, meetups
PRIVATE ACTIVITIES (2 people): Personal services, coaching, 1-on-1 projects

IMPORTANT RULES FOR EXISTING GROUPS:
- Suggest JOIN_EXISTING_GROUP if users want the SAME activity as an existing group (regardless of membership status)
- If users want a DIFFERENT activity than existing groups, create a NEW group for that specific activity
- Users can have multiple groups for different activities
- Existing groups can grow by adding new members who share the same interest

EXAMPLE: If there's an existing group for an activity and a new user wants the same activity, suggest JOIN_EXISTING_GROUP even if they're not currently a member.

Be thorough and find ALL potential matches!
        `.trim();
    }

    private async analyzeAllMatches(wishlists: WishlistData[], existingGroups?: GroupData[]): Promise<MatchResult[]> {
        const prompt = this.buildAllMatchesPrompt(wishlists, existingGroups);
        
        console.log("\n" + "=".repeat(100));
        console.log("🤖 AI REQUEST DEBUG - FULL PROMPT SENT TO AI:");
        console.log("=".repeat(100));
        console.log(prompt);
        console.log("=".repeat(100));
        console.log(`📊 Prompt length: ${prompt.length} characters`);
        console.log(`📊 Number of wishlists: ${wishlists.length}`);
        console.log("=".repeat(100) + "\n");
        
        const response = await this.openai.chat.completions.create({
            model: "gpt-4",
            messages: [
                {
                    role: "system",
                    content: "You are an AI matching assistant. Your goal is to find meaningful connections between people based on their wishlists. Analyze all wishlists and return ALL matches found as a JSON array."
                },
                {
                    role: "user",
                    content: prompt,
                },
            ],
            temperature: 0.7,
            max_tokens: 4000, // Increased token limit for multiple matches
        });

        const content = response.choices[0]?.message?.content;
        
        console.log("\n" + "=".repeat(100));
        console.log("🤖 AI RESPONSE DEBUG - FULL RESPONSE FROM AI:");
        console.log("=".repeat(100));
        console.log(content);
        console.log("=".repeat(100));
        console.log(`📊 Response length: ${content?.length || 0} characters`);
        console.log(`📊 Usage: ${JSON.stringify(response.usage, null, 2)}`);
        console.log("=".repeat(100) + "\n");
        
        if (!content) {
            throw new Error("No response from OpenAI");
        }

        try {
            // Try to extract JSON array from the response
            const jsonMatch = content.match(/\[[\s\S]*\]/);
            if (!jsonMatch) {
                console.log("❌ DEBUG: No JSON array pattern found in response");
                console.log("❌ DEBUG: Looking for pattern: /\\[[\\s\\S]*\\]/");
                throw new Error("No JSON array found in response");
            }

            console.log("\n" + "=".repeat(100));
            console.log("🔍 JSON EXTRACTION DEBUG:");
            console.log("=".repeat(100));
            console.log("📝 Extracted JSON string:");
            console.log(jsonMatch[0]);
            console.log("=".repeat(100) + "\n");

            const matches = JSON.parse(jsonMatch[0]);
            
            console.log("\n" + "=".repeat(100));
            console.log("🔍 PARSED MATCHES DEBUG:");
            console.log("=".repeat(100));
            console.log(`📊 Total matches from AI: ${matches.length}`);
            console.log("📝 Raw matches array:");
            console.log(JSON.stringify(matches, null, 2));
            console.log("=".repeat(100) + "\n");
            
            if (!Array.isArray(matches)) {
                throw new Error("Response is not an array");
            }

            // Validate and filter matches
            const validMatches: MatchResult[] = [];
            for (let i = 0; i < matches.length; i++) {
                const match = matches[i];
                console.log(`🔍 Validating match ${i + 1}:`, JSON.stringify(match, null, 2));
                
                // Check if this is a JOIN_EXISTING_GROUP match (can have 1 user)
                const isJoinExistingGroup = match.suggestedActivities?.some((activity: any) => 
                    typeof activity === 'string' && activity.startsWith('JOIN_EXISTING_GROUP:')
                );
                
                const minUsers = isJoinExistingGroup ? 1 : 2;
                
                if (typeof match.confidence === 'number' && 
                    match.confidence > 0.7 &&
                    ['private', 'group'].includes(match.matchType) &&
                    Array.isArray(match.userIds) &&
                    match.userIds.length >= minUsers &&
                    match.activityCategory) {
                    
                    console.log(`✅ Match ${i + 1} is VALID`);
                    validMatches.push({
                        confidence: match.confidence,
                        matchType: match.matchType,
                        reason: match.reason || "",
                        matchedWants: match.matchedWants || [],
                        matchedOffers: match.matchedOffers || [],
                        suggestedActivities: match.suggestedActivities || [],
                        aiAnalysis: match.aiAnalysis || "",
                        userIds: match.userIds,
                        activityCategory: match.activityCategory
                    });
                } else {
                    console.log(`❌ Match ${i + 1} is INVALID:`);
                    console.log(`   - confidence: ${match.confidence} (type: ${typeof match.confidence})`);
                    console.log(`   - matchType: ${match.matchType} (valid: ${['private', 'group'].includes(match.matchType)})`);
                    console.log(`   - userIds: ${JSON.stringify(match.userIds)} (isArray: ${Array.isArray(match.userIds)}, length: ${match.userIds?.length}, min required: ${minUsers})`);
                    console.log(`   - activityCategory: ${match.activityCategory}`);
                    console.log(`   - isJoinExistingGroup: ${isJoinExistingGroup}`);
                }
            }

            console.log(`✅ AI found ${validMatches.length} valid matches from ${matches.length} total suggestions`);
            return validMatches;
        } catch (error) {
            console.error("Failed to parse OpenAI response:", content);
            console.error("Parse error:", error);
            throw new Error("Invalid response format from OpenAI");
        }
    }
}
