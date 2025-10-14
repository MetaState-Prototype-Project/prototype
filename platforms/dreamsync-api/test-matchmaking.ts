import "reflect-metadata";
import { AIMatchingService } from "./src/services/AIMatchingService";
import { AppDataSource } from "./src/database/data-source";
import { User } from "./src/database/entities/User";
import { Wishlist } from "./src/database/entities/Wishlist";
import { Match } from "./src/database/entities/Match";
import { v4 as uuidv4 } from "uuid";

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


class MatchmakingTestRunner {
    private aiMatchingService: AIMatchingService;

    constructor() {
        this.aiMatchingService = new AIMatchingService();
    }

    async run() {
        console.log("🚀 DREAMSYNC MATCHMAKING TEST RUNNER");
        console.log("=" .repeat(80));
        console.log(`📊 Testing with ${YOUR_WISHLIST_DATA.length} wishlists`);

        try {
            // Initialize database
            await AppDataSource.initialize();
            console.log("✅ Database connected");

            // Create test data
            console.log("\n📝 Creating test users and wishlists...");
            await this.createTestData();

            // Run AI matching
            console.log("\n🤖 Running AI Matching Service...");
            console.log("-".repeat(50));
            await this.aiMatchingService.findMatches();

            // Display results
            await this.showAllMatches();
            await this.showStats();

        } catch (error) {
            console.error("❌ ERROR:", error);
            if (error instanceof Error) {
                console.error(error.stack);
            }
        } finally {
            await AppDataSource.destroy();
            console.log("\n✅ Test completed - Database disconnected");
        }
    }

    private async createTestData() {
        const userRepo = AppDataSource.getRepository(User);
        const wishlistRepo = AppDataSource.getRepository(Wishlist);

        for (const data of YOUR_WISHLIST_DATA) {
            // Create or find user
            let user = await userRepo.findOne({ where: { id: data.userId } });
            if (!user) {
                user = userRepo.create({
                    id: data.userId,
                    ename: data.userId,
                    name: `Test User ${data.userId.split('-').pop()}`,
                    handle: data.userId,
                    isVerified: false,
                    isPrivate: false,
                });
                await userRepo.save(user);
                console.log(`✅ Created user: ${user.name}`);
            }

            // Check if wishlist already exists
            const existingWishlist = await wishlistRepo.findOne({ 
                where: { userId: user.id } 
            });

            if (!existingWishlist) {
                // Create wishlist
                const wishlist = wishlistRepo.create({
                    content: data.content,
                    isActive: data.isActive,
                    user: user,
                    userId: user.id,
                });
                await wishlistRepo.save(wishlist);
                console.log(`✅ Created wishlist for: ${user.name}`);
            } else {
                console.log(`⏭️ Wishlist already exists for: ${user.name}`);
            }
        }
    }

    private async showAllMatches() {
        console.log("\n🎯 ALL MATCHES FOUND:");
        console.log("=" .repeat(80));

        const matchRepo = AppDataSource.getRepository(Match);
        const matches = await matchRepo.find({
            relations: ["userA", "userB"],
            order: { createdAt: "DESC" }
        });

        if (matches.length === 0) {
            console.log("❌ NO MATCHES FOUND!");
            console.log("💡 This could mean:");
            console.log("   - Confidence threshold too high (>70%)");
            console.log("   - Not enough overlapping interests");
            console.log("   - AI service not working properly");
            return;
        }

        console.log(`📊 TOTAL MATCHES: ${matches.length}\n`);

        matches.forEach((match, i) => {
            console.log(`🎯 MATCH #${i + 1}`);
            console.log(`🆔 ID: ${match.id}`);
            console.log(`👤 User A: ${match.userA?.name || 'Unknown'} (${match.userAId})`);
            console.log(`👤 User B: ${match.userB?.name || 'Unknown'} (${match.userBId})`);
            console.log(`🎯 Type: ${match.type}`);
            console.log(`📊 Confidence: ${Math.round(match.matchData.confidence * 100)}%`);
            console.log(`📝 Reason: ${match.reason}`);
            console.log(`✅ Status: ${match.status}`);
            console.log(`🔗 Active: ${match.isActive ? 'YES' : 'NO'}`);
            console.log(`👥 A Consent: ${match.userAConsent ? 'YES' : 'NO'}`);
            console.log(`👥 B Consent: ${match.userBConsent ? 'YES' : 'NO'}`);
            
            if (match.matchData.suggestedActivities && match.matchData.suggestedActivities.length > 0) {
                console.log(`🎮 Activities: ${match.matchData.suggestedActivities.join(", ")}`);
            }
            
            if (match.matchData.matchedWants && match.matchData.matchedWants.length > 0) {
                console.log(`💭 Wants: ${match.matchData.matchedWants.join(", ")}`);
            }
            
            if (match.matchData.matchedOffers && match.matchData.matchedOffers.length > 0) {
                console.log(`🎁 Offers: ${match.matchData.matchedOffers.join(", ")}`);
            }

            if (match.matchData.aiAnalysis) {
                console.log(`🤖 Analysis: ${match.matchData.aiAnalysis}`);
            }

            console.log(`📅 Created: ${match.createdAt}`);
            console.log("-".repeat(40));
        });
    }

    private async showStats() {
        console.log("\n📈 MATCHING STATISTICS:");
        console.log("=" .repeat(40));

        try {
            const stats = await this.aiMatchingService.getMatchingStats();
            
            console.log(`📋 Total Wishlists: ${stats.totalWishlists}`);
            console.log(`🎯 Total Matches: ${stats.totalMatches}`);
            console.log(`⏳ Pending Matches: ${stats.pendingMatches}`);
            console.log(`✅ Accepted Matches: ${stats.acceptedMatches}`);
            console.log(`❌ Declined Matches: ${stats.declinedMatches}`);
            console.log(`🔗 Active Matches: ${stats.activeMatches}`);

            // Calculate match rate
            const totalPossiblePairs = stats.totalWishlists * (stats.totalWishlists - 1) / 2;
            const matchRate = totalPossiblePairs > 0 ? 
                ((stats.totalMatches / totalPossiblePairs) * 100).toFixed(2) : 0;
            console.log(`📊 Match Rate: ${matchRate}% (${stats.totalMatches}/${totalPossiblePairs} possible pairs)`);

        } catch (error) {
            console.error("❌ Error getting stats:", error);
        }
    }
}

// Run the test
const runner = new MatchmakingTestRunner();
runner.run().catch(console.error);
