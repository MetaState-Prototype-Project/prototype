import { db } from "./db";
import { 
  users, profiles, skills, interests as interestsTable, groups, groupMemberships, 
  wishes, matches, suggestions, wishUserSuggestions, wishGroupSuggestions 
} from "@shared/schema";
import { eq, and, ne, sql } from "drizzle-orm";

function getRandomItem<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

function getRandomItems<T>(array: T[], count: number): T[] {
  const shuffled = [...array].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}

export async function generateTestSuggestions() {
  console.log("🤖 Generating comprehensive test suggestions...");
  
  try {
    // Get all users, groups, and wishes
    const allUsers = await db.select().from(users).limit(50);
    const allGroups = await db.select().from(groups).limit(50);
    const allWishes = await db.select().from(wishes).limit(100);
    
    console.log(`📊 Processing ${allUsers.length} users, ${allGroups.length} groups, ${allWishes.length} wishes...`);
    
    let userSuggestionsCreated = 0;
    let groupSuggestionsCreated = 0;
    let matchesCreated = 0;
    let generalSuggestionsCreated = 0;
    
    // 1. Create wish-based user suggestions
    console.log("👥 Creating wish-based user suggestions...");
    for (const wish of allWishes.slice(0, 50)) {
      // Find 2-3 users who might help with this wish
      const potentialHelpers = getRandomItems(
        allUsers.filter(u => u.id !== wish.userId), 
        Math.floor(Math.random() * 3) + 2
      );
      
      for (const helper of potentialHelpers) {
        try {
          await db.insert(wishUserSuggestions).values({
            wishId: wish.id,
            userId: helper.id,
            relevanceScore: Math.floor(Math.random() * 30) + 70, // 70-100%
            reason: `${helper.firstName} ${helper.lastName} has relevant experience that could help with "${wish.title}". Consider connecting to share knowledge and get guidance.`,
          });
          userSuggestionsCreated++;
        } catch (error) {
          // Ignore duplicates
        }
      }
    }
    
    // 2. Create wish-based group suggestions
    console.log("🏢 Creating wish-based group suggestions...");
    for (const wish of allWishes.slice(0, 50)) {
      // Find 2-3 relevant groups for each wish
      const relevantGroups = getRandomItems(allGroups, Math.floor(Math.random() * 3) + 2);
      
      for (const group of relevantGroups) {
        try {
          await db.insert(wishGroupSuggestions).values({
            wishId: wish.id,
            groupId: group.id,
            relevanceScore: Math.floor(Math.random() * 30) + 70, // 70-100%
            reason: `The "${group.name}" group could be perfect for achieving "${wish.title}". Join to connect with like-minded individuals and get support.`,
          });
          groupSuggestionsCreated++;
        } catch (error) {
          // Ignore duplicates
        }
      }
    }
    
    // 3. Create user-to-user matches based on common interests
    console.log("💝 Creating user matches based on compatibility...");
    for (let i = 0; i < Math.min(30, allUsers.length); i++) {
      const user1 = allUsers[i];
      
      // Find 2-3 potential matches for each user
      for (let j = i + 1; j < Math.min(i + 10, allUsers.length); j++) {
        const user2 = allUsers[j];
        
        // Check if match already exists
        const existingMatch = await db.select().from(matches)
          .where(
            and(
              eq(matches.userId1, user1.id),
              eq(matches.userId2, user2.id)
            )
          );
        
        if (existingMatch.length === 0 && Math.random() > 0.6) { // 40% chance of match
          try {
            const compatibilityScore = Math.floor(Math.random() * 30) + 70; // 70-100%
            const matchReason = `You both share similar interests and could have great conversations about professional development and personal growth.`;
            
            await db.insert(matches).values({
              userId1: user1.id,
              userId2: user2.id,
              compatibilityScore,
              matchReason,
              status: "pending",
            });
            matchesCreated++;
          } catch (error) {
            // Ignore duplicates
          }
        }
        
        if (matchesCreated >= 50) break; // Limit matches
      }
      
      if (matchesCreated >= 50) break;
    }
    
    // 4. Create general suggestions for users
    console.log("🎯 Creating general suggestions...");
    const suggestionTypes = [
      { type: "user", reason: "Based on your profile and interests, you might enjoy connecting with this person who shares similar goals." },
      { type: "group", reason: "This group aligns with your interests and could help you grow your network and skills." },
    ];
    
    for (const user of allUsers.slice(0, 30)) {
      // Create 3-5 suggestions per user
      const suggestionCount = Math.floor(Math.random() * 3) + 3;
      
      for (let i = 0; i < suggestionCount; i++) {
        const suggestionType = getRandomItem(suggestionTypes);
        
        try {
          if (suggestionType.type === "user") {
            const suggestedUser = getRandomItem(allUsers.filter(u => u.id !== user.id));
            await db.insert(suggestions).values({
              userId: user.id,
              targetType: "user",
              targetId: suggestedUser.id,
              reason: suggestionType.reason,
              score: Math.floor(Math.random() * 30) + 70, // 70-100%
              status: "pending",
            });
          } else {
            const suggestedGroup = getRandomItem(allGroups);
            await db.insert(suggestions).values({
              userId: user.id,
              targetType: "group",
              targetId: suggestedGroup.id,
              reason: suggestionType.reason,
              score: Math.floor(Math.random() * 30) + 70, // 70-100%
              status: "pending",
            });
          }
          generalSuggestionsCreated++;
        } catch (error) {
          // Ignore duplicates
        }
      }
    }
    
    // Get final statistics
    const finalStats = {
      wishUserSuggestions: await db.select().from(wishUserSuggestions).then(r => r.length),
      wishGroupSuggestions: await db.select().from(wishGroupSuggestions).then(r => r.length),
      matches: await db.select().from(matches).then(r => r.length),
      generalSuggestions: await db.select().from(suggestions).then(r => r.length),
    };
    
    console.log("✅ Test suggestions generation completed!");
    console.log(`📈 Suggestions Created:`);
    console.log(`   👥 Wish-based user suggestions: ${userSuggestionsCreated} (Total: ${finalStats.wishUserSuggestions})`);
    console.log(`   🏢 Wish-based group suggestions: ${groupSuggestionsCreated} (Total: ${finalStats.wishGroupSuggestions})`);
    console.log(`   💝 User matches: ${matchesCreated} (Total: ${finalStats.matches})`);
    console.log(`   🎯 General suggestions: ${generalSuggestionsCreated} (Total: ${finalStats.generalSuggestions})`);
    
  } catch (error) {
    console.error("❌ Error generating test suggestions:", error);
    throw error;
  }
}