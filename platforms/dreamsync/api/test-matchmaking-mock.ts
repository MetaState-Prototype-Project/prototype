import "reflect-metadata";
import { v4 as uuidv4 } from "uuid";
import { config } from "dotenv";
import path from "node:path";
import { MatchingService, MatchResult, WishlistData } from "./src/services/MatchingService";

// Load environment variables from root directory
config({ path: path.resolve(__dirname, "../../.env") });

// 🔥 PUT YOUR JSON DATA HERE 🔥
const YOUR_WISHLIST_DATA = [
    {
      "userId": "user-001",
      "content": "## What I Want\n- Learn to play chess better\n- Find weekend partners to play in person or online\n- Teach someone English in exchange for strategy coaching\n\n## What I Can Do\n- Teach spoken English\n- Host online debate clubs\n- Help create structured learning plans",
      "isActive": true
    },
    {
      "userId": "user-002",
      "content": "## What I Want\n- Find chess partners to play classical games\n- Learn basic Italian phrases\n- Get feedback on my coding side projects\n\n## What I Can Do\n- Teach Python fundamentals\n- Offer data visualization tutorials\n- Share chess strategies for beginners",
      "isActive": true
    },
    {
      "userId": "user-003",
      "content": "## What I Want\n- Practice English conversation\n- Learn how to edit short videos\n- Collaborate on a small YouTube channel\n\n## What I Can Do\n- Teach Spanish\n- Provide video ideas and scripts\n- Help with voiceover narration",
      "isActive": true
    },
    {
      "userId": "user-004",
      "content": "## What I Want\n- Find a videographer for short-form content\n- Collaborate on a personal YouTube project\n- Learn basic sound mixing\n\n## What I Can Do\n- Offer graphic design help\n- Create thumbnails and banners\n- Share social media growth insights",
      "isActive": true
    },
    {
      "userId": "user-005",
      "content": "## What I Want\n- Learn basic French\n- Join a weekend hiking group\n- Find a mentor for product management\n\n## What I Can Do\n- Share project planning templates\n- Offer UX/UI design mentorship\n- Teach Figma basics",
      "isActive": true
    },
    {
      "userId": "user-006",
      "content": "## What I Want\n- Play chess casually on weekends\n- Find a driving instructor nearby\n- Join an accountability group for habit tracking\n\n## What I Can Do\n- Tutor high-school math\n- Help with website setup\n- Walk dogs on weekends",
      "isActive": true
    },
    {
      "userId": "user-007",
      "content": "## What I Want\n- Join a morning yoga circle\n- Learn vegetarian recipes\n- Find someone to swap language lessons (Japanese-English)\n\n## What I Can Do\n- Teach basic Japanese\n- Host online yoga sessions\n- Offer guided meditations",
      "isActive": true
    },
    {
      "userId": "user-008",
      "content": "## What I Want\n- Find someone to practice Italian conversation\n- Join a photography learning group\n- Learn Photoshop retouching\n\n## What I Can Do\n- Offer Italian tutoring\n- Teach travel photography\n- Share Lightroom presets",
      "isActive": true
    },
    {
      "userId": "user-009",
      "content": "## What I Want\n- Find chess partners near me\n- Learn public speaking\n- Join a community debating group\n\n## What I Can Do\n- Teach storytelling structure\n- Coach debate techniques\n- Offer language editing for speeches",
      "isActive": true
    },
    {
      "userId": "user-010",
      "content": "## What I Want\n- Collaborate on YouTube shorts\n- Learn Adobe Premiere Pro\n- Find scriptwriters for fun content\n\n## What I Can Do\n- Edit long-form videos\n- Share SEO growth techniques\n- Create thumbnails and hooks",
      "isActive": true
    },
    {
      "userId": "user-011",
      "content": "## What I Want\n- Find someone to teach me guitar\n- Collaborate on songwriting\n- Learn music production\n\n## What I Can Do\n- Teach piano\n- Offer lyric writing help\n- Record vocals in my home studio",
      "isActive": true
    },
    {
      "userId": "user-012",
      "content": "## What I Want\n- Learn cooking traditional Indian dishes\n- Find a partner to share meal prep ideas\n- Host potluck dinners\n\n## What I Can Do\n- Teach Italian recipes\n- Plan grocery budgets\n- Organize dinner parties",
      "isActive": true
    },
    {
      "userId": "user-013",
      "content": "## What I Want\n- Go hiking once a month\n- Learn camping survival basics\n- Find travel buddies for mountain trips\n\n## What I Can Do\n- Share camping gear\n- Lead beginner hikes\n- Teach first aid",
      "isActive": true
    },
    {
      "userId": "user-014",
      "content": "## What I Want\n- Get help preparing for startup pitch competitions\n- Find co-founders for a side project\n- Learn investor storytelling\n\n## What I Can Do\n- Offer pitch deck reviews\n- Mentor in fundraising strategy\n- Share investor contact frameworks",
      "isActive": true
    },
    {
      "userId": "user-015",
      "content": "## What I Want\n- Learn photography composition\n- Find local models to collaborate with\n- Join weekend photo walks\n\n## What I Can Do\n- Offer portrait editing lessons\n- Teach Lightroom\n- Share social media posting strategies",
      "isActive": true
    },
    {
      "userId": "user-016",
      "content": "## What I Want\n- Find a language partner for German\n- Learn React basics\n- Join a small coding accountability circle\n\n## What I Can Do\n- Teach JavaScript\n- Review frontend portfolios\n- Share resume feedback",
      "isActive": true
    },
    {
      "userId": "user-017",
      "content": "## What I Want\n- Join an entrepreneurship mastermind\n- Learn branding fundamentals\n- Find designers for collaboration\n\n## What I Can Do\n- Share startup operations experience\n- Offer logo design\n- Teach presentation building",
      "isActive": true
    },
    {
      "userId": "user-018",
      "content": "## What I Want\n- Need a dog walker for weekdays\n- Find someone to teach me basic video editing\n- Offer pet-sitting exchange\n\n## What I Can Do\n- Offer weekend pet sitting\n- Teach photography\n- Provide carpooling help",
      "isActive": true
    },
    {
      "userId": "user-019",
      "content": "## What I Want\n- Join a blockchain developers group\n- Find open-source collaboration partners\n- Learn tokenomics\n\n## What I Can Do\n- Teach Solidity basics\n- Review smart contracts\n- Offer product architecture help",
      "isActive": true
    },
    {
      "userId": "user-020",
      "content": "## What I Want\n- Find local people who love chess or Go\n- Organize strategy game nights\n- Discuss game theory\n\n## What I Can Do\n- Host chess nights\n- Provide snacks\n- Teach Go to beginners",
      "isActive": true
    },
    {
      "userId": "user-021",
      "content": "## What I Want\n- Join a creative writing critique group\n- Find beta readers\n- Learn screenwriting\n\n## What I Can Do\n- Offer story structure feedback\n- Edit short fiction\n- Teach writing exercises",
      "isActive": true
    },
    {
      "userId": "user-022",
      "content": "## What I Want\n- Find someone to exchange language (Japanese-English)\n- Watch anime and discuss story themes\n- Learn Japanese culture\n\n## What I Can Do\n- Teach English conversation\n- Offer travel tips for India\n- Host language meetups",
      "isActive": true
    },
    {
      "userId": "user-023",
      "content": "## What I Want\n- Build a mindfulness habit\n- Join a meditation accountability group\n- Learn deep-breathing techniques\n\n## What I Can Do\n- Host group meditations\n- Offer yoga breathing guidance\n- Teach focus improvement",
      "isActive": true
    },
    {
      "userId": "user-024",
      "content": "## What I Want\n- Collaborate on a YouTube tech channel\n- Learn video storytelling\n- Improve camera confidence\n\n## What I Can Do\n- Edit videos\n- Design thumbnails\n- Share analytics insights",
      "isActive": true
    },
    {
      "userId": "user-025",
      "content": "## What I Want\n- Study with someone for CFA exams\n- Discuss financial modeling\n- Find a study accountability partner\n\n## What I Can Do\n- Teach Excel shortcuts\n- Share finance flashcards\n- Review resumes",
      "isActive": true
    },
    {
      "userId": "user-026",
      "content": "## What I Want\n- Learn to draw digitally\n- Collaborate on a webcomic\n- Join art critique sessions\n\n## What I Can Do\n- Teach illustration fundamentals\n- Provide color theory lessons\n- Offer sketch feedback",
      "isActive": true
    },
    {
      "userId": "user-027",
      "content": "## What I Want\n- Try new restaurants weekly\n- Learn photography for food blogging\n- Find content creators to collaborate with\n\n## What I Can Do\n- Teach video editing\n- Share restaurant lists\n- Offer marketing ideas",
      "isActive": true
    },
    {
      "userId": "user-028",
      "content": "## What I Want\n- Make an indie short film\n- Find actors, editors, and composers\n- Learn script formatting\n\n## What I Can Do\n- Write screenplays\n- Edit video\n- Manage production logistics",
      "isActive": true
    },
    {
      "userId": "user-029",
      "content": "## What I Want\n- Find an esports team\n- Play Valorant competitively\n- Learn FPS strategies\n\n## What I Can Do\n- Coach aim training\n- Record highlight reels\n- Manage Discord tournaments",
      "isActive": true
    },
    {
      "userId": "user-030",
      "content": "## What I Want\n- Learn UI animation\n- Get app design feedback\n- Join a design project group\n\n## What I Can Do\n- Teach Figma auto-layout\n- Review UX flows\n- Offer freelance advice",
      "isActive": true
    },
    {
      "userId": "user-031",
      "content": "## What I Want\n- Learn gardening\n- Join a plant exchange network\n- Share sustainability tips\n\n## What I Can Do\n- Teach composting\n- Build small planters\n- Organize cleanups",
      "isActive": true
    },
    {
      "userId": "user-032",
      "content": "## What I Want\n- Learn sign language\n- Volunteer for inclusion events\n- Join social good initiatives\n\n## What I Can Do\n- Teach writing\n- Create social campaigns\n- Help raise funds",
      "isActive": true
    },
    {
      "userId": "user-033",
      "content": "## What I Want\n- Join startup pitch practices\n- Learn business storytelling\n- Network with founders\n\n## What I Can Do\n- Review decks\n- Offer branding feedback\n- Share investor email templates",
      "isActive": true
    },
    {
      "userId": "user-034",
      "content": "## What I Want\n- Learn to swim\n- Overcome fear of deep water\n- Join weekend sports activities\n\n## What I Can Do\n- Offer gym training\n- Teach basic nutrition\n- Share stretching routines",
      "isActive": true
    },
    {
      "userId": "user-035",
      "content": "## What I Want\n- Learn Rust programming\n- Join open-source hackathons\n- Build a developer network\n\n## What I Can Do\n- Teach Go and backend systems\n- Review PRs\n- Mentor in clean code",
      "isActive": true
    },
    {
      "userId": "user-036",
      "content": "## What I Want\n- Join a local theatre group\n- Learn acting\n- Find script collaborators\n\n## What I Can Do\n- Teach stage direction\n- Offer costume design\n- Manage rehearsals",
      "isActive": true
    },
    {
      "userId": "user-037",
      "content": "## What I Want\n- Find co-living partners\n- Learn interior design\n- Build sustainable homes\n\n## What I Can Do\n- Offer carpentry skills\n- Teach budgeting\n- Draft layouts",
      "isActive": true
    },
    {
      "userId": "user-038",
      "content": "## What I Want\n- Plan meditation retreats\n- Meet people who enjoy silent travel\n- Share mindfulness practices\n\n## What I Can Do\n- Host group meditations\n- Organize events\n- Offer photography coverage",
      "isActive": true
    },
    {
      "userId": "user-039",
      "content": "## What I Want\n- Find gym accountability partners\n- Learn to meal prep\n- Join weekly fitness challenges\n\n## What I Can Do\n- Create workout plans\n- Offer nutrition tips\n- Share progress tracking tools",
      "isActive": true
    },
    {
      "userId": "user-040",
      "content": "## What I Want\n- Teach chess to someone\n- Learn yoga in exchange\n- Join skill swap sessions\n\n## What I Can Do\n- Coach chess players\n- Mentor founders\n- Organize community meetups",
      "isActive": true
    }
  ]
  

interface MockUser {
    id: string;
    ename: string;
    name: string;
    handle: string;
}

interface MockWishlist {
    id: string;
    content: string;
    isActive: boolean;
    user: MockUser;
    userId: string;
}

interface MockMatch {
    id: string;
    type: "private" | "group";
    status: "pending" | "accepted" | "declined" | "expired";
    reason: string;
    matchData: {
        confidence: number;
        matchedWants: string[];
        matchedOffers: string[];
        suggestedActivities: string[];
        aiAnalysis: string;
        activityCategory?: string;
        userIds?: string[];
    };
    userA: MockUser;
    userB: MockUser;
    userAId: string;
    userBId: string;
    createdAt: Date;
}

class MockMatchmakingTestRunner {
    private matchingService: MatchingService;
    private mockUsers: MockUser[] = [];
    private mockWishlists: MockWishlist[] = [];
    private mockMatches: MockMatch[] = [];

    constructor() {
        this.matchingService = new MatchingService();
    }

    async run() {
        console.log("🚀 DREAMSYNC MATCHMAKING MOCK TEST RUNNER");
        console.log("=" .repeat(80));
        console.log(`📊 Testing with ${YOUR_WISHLIST_DATA.length} wishlists`);
        console.log("🔥 NO DATABASE - PURE MOCK TESTING 🔥");

        try {
            // Create mock data
            console.log("\n📝 Creating mock users and wishlists...");
            await this.createMockData();

            // Run AI matching
            console.log("\n🤖 Running AI Matching Service...");
            console.log("-".repeat(50));
            await this.runAIMatching();

            // Display results
            await this.showAllMatches();
            await this.showStats();

        } catch (error) {
            console.error("❌ ERROR:", error);
            if (error instanceof Error) {
                console.error(error.stack);
            }
        }
    }

    private async createMockData() {
        for (let i = 0; i < YOUR_WISHLIST_DATA.length; i++) {
            const data = YOUR_WISHLIST_DATA[i];
            
            // Create mock user
            const user: MockUser = {
                id: data.userId,
                ename: `test-user-${i + 1}`,
                name: `Test User ${i + 1}`,
                handle: `testuser${i + 1}`,
            };
            this.mockUsers.push(user);

            // Create mock wishlist
            const wishlist: MockWishlist = {
                id: uuidv4(),
                content: data.content,
                isActive: data.isActive,
                user: user,
                userId: user.id,
            };
            this.mockWishlists.push(wishlist);

            console.log(`✅ Created mock user: ${user.name}`);
        }
    }

    private async runAIMatching() {
        console.log("🤖 Starting AI matching process...");
        
        // Convert to shared service format
        const wishlistData: WishlistData[] = this.mockWishlists.map(wishlist => ({
            id: wishlist.id,
            content: wishlist.content,
            userId: wishlist.userId,
            user: {
                id: wishlist.user.id,
                name: wishlist.user.name,
                ename: wishlist.user.ename
            }
        }));

        // Use shared matching service for parallel processing
        const matchResults = await this.matchingService.findMatches(wishlistData);

        // Create mock matches from results
        let totalMatches = 0;
        for (const matchResult of matchResults) {
            // Find all wishlists for this match (can be 2+ users)
            const wishlists = matchResult.userIds.map(userId => 
                this.mockWishlists.find(w => w.userId === userId)
            ).filter(Boolean) as MockWishlist[];
            
            if (wishlists.length !== matchResult.userIds.length) {
                console.log(`❌ Could not find all wishlists for match: ${matchResult.userIds.join(', ')}`);
                continue;
            }

            // Check if match already exists (any combination of these users)
            const existingMatch = this.mockMatches.find(match => {
                const matchUserIds = [match.userAId, match.userBId];
                return matchResult.userIds.every(id => matchUserIds.includes(id)) &&
                       matchUserIds.every(id => matchResult.userIds.includes(id));
            });

            if (existingMatch) {
                const userNames = wishlists.map(w => w.user.name).join(', ');
                console.log(`⏭️ Match already exists: ${userNames}`);
                continue;
            }

            await this.createMockMatch(wishlists, matchResult);
            totalMatches++;
            const userNames = wishlists.map(w => w.user.name).join(', ');
            console.log(`✅ Created ${matchResult.matchType} match ${totalMatches} for ${userNames} (confidence: ${matchResult.confidence}, category: ${matchResult.activityCategory})`);
        }

        console.log(`🎉 AI matching process completed! Created ${totalMatches} matches from ${matchResults.length} AI results`);
    }

    private async createMockMatch(wishlists: MockWishlist[], matchResult: MatchResult): Promise<void> {
        // For now, we'll create a match between the first two users
        // In a real system, you'd handle multiple users differently
        const wishlistA = wishlists[0];
        const wishlistB = wishlists[1];
        
        const match: MockMatch = {
            id: uuidv4(),
            type: matchResult.matchType,
            status: "pending",
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
            userA: wishlistA.user,
            userB: wishlistB.user,
            userAId: wishlistA.userId,
            userBId: wishlistB.userId,
            createdAt: new Date()
        };

        this.mockMatches.push(match);
    }

    private async showAllMatches() {
        console.log("\n🎯 ALL MATCHES FOUND:");
        console.log("=" .repeat(80));

        if (this.mockMatches.length === 0) {
            console.log("❌ NO MATCHES FOUND!");
            console.log("💡 This could mean:");
            console.log("   - Confidence threshold too high (>70%)");
            console.log("   - Not enough overlapping interests");
            console.log("   - AI service not working properly");
            return;
        }

        console.log(`📊 TOTAL MATCHES: ${this.mockMatches.length}\n`);

        this.mockMatches.forEach((match, i) => {
            const userNames = [match.userA.name, match.userB.name];
            if (match.matchData.userIds && match.matchData.userIds.length > 2) {
                // For group matches, show all users
                const allUserNames = match.matchData.userIds.map(userId => {
                    const user = this.mockUsers.find(u => u.id === userId);
                    return user ? user.name : userId;
                });
                console.log(`👥 Users: ${allUserNames.join(", ")}`);
            } else {
                console.log(`👥 Users: ${userNames.join(", ")}`);
            }
            console.log(`🎯 Type: ${match.type}`);
            console.log(`📝 Reason: ${match.reason}`);
            console.log("-".repeat(40));
        });
    }

    private async showStats() {
        console.log("\n📈 MATCHING STATISTICS:");
        console.log("=" .repeat(40));

        const totalWishlists = this.mockWishlists.length;
        const totalMatches = this.mockMatches.length;
        const pendingMatches = this.mockMatches.filter(m => m.status === "pending").length;
        const acceptedMatches = this.mockMatches.filter(m => m.status === "accepted").length;
        const declinedMatches = this.mockMatches.filter(m => m.status === "declined").length;
        const activeMatches = this.mockMatches.filter(m => m.status === "pending").length;

        console.log(`📋 Total Wishlists: ${totalWishlists}`);
        console.log(`🎯 Total Matches: ${totalMatches}`);
        console.log(`⏳ Pending Matches: ${pendingMatches}`);
        console.log(`✅ Accepted Matches: ${acceptedMatches}`);
        console.log(`❌ Declined Matches: ${declinedMatches}`);
        console.log(`🔗 Active Matches: ${activeMatches}`);

        // Calculate match rate
        const totalPossiblePairs = totalWishlists * (totalWishlists - 1) / 2;
        const matchRate = totalPossiblePairs > 0 ? 
            ((totalMatches / totalPossiblePairs) * 100).toFixed(2) : 0;
        console.log(`📊 Match Rate: ${matchRate}% (${totalMatches}/${totalPossiblePairs} possible pairs)`);
    }
}

// Run the test
const runner = new MockMatchmakingTestRunner();
runner.run().catch(console.error);
