import { db } from "./db";
import { 
  users, profiles, skills, interests as interestsTable, groups, groupMemberships, 
  wishes, matches, suggestions 
} from "@shared/schema";
import { eq, and, or } from "drizzle-orm";

// Enhanced wish categories for realistic user desires
const wishCategories = {
  career: [
    "Learn Python programming for data science",
    "Get promoted to senior management role",
    "Start my own consulting business",
    "Learn digital marketing and SEO",
    "Transition into cybersecurity field",
    "Master project management certification",
    "Build a professional network in tech",
    "Learn web development and create apps",
    "Get certified in cloud computing (AWS/Azure)",
    "Develop leadership and public speaking skills"
  ],
  personal: [
    "Learn a new language fluently (Spanish/French/Mandarin)",
    "Run a marathon in under 4 hours",
    "Learn to play guitar and write songs",
    "Travel to Japan and experience the culture",
    "Learn cooking and master 5-star recipes",
    "Start a photography hobby and build portfolio",
    "Learn meditation and mindfulness practices",
    "Take up rock climbing and join a climbing gym",
    "Learn woodworking and build furniture",
    "Develop a consistent fitness routine"
  ],
  creative: [
    "Write and publish a novel",
    "Learn digital art and illustration",
    "Start a YouTube channel or podcast",
    "Learn video editing and filmmaking",
    "Master calligraphy and hand lettering",
    "Learn pottery and ceramics",
    "Create and sell artwork online",
    "Learn dance (salsa, ballroom, or hip-hop)",
    "Start a blog about my passions",
    "Learn graphic design for freelance work"
  ],
  social: [
    "Build deeper friendships and connections",
    "Find a romantic partner who shares my values",
    "Join a book club or discussion group",
    "Volunteer for causes I care about",
    "Organize community events and meetups",
    "Find workout partners for motivation",
    "Connect with other parents in my area",
    "Join a professional networking group",
    "Find people to travel with",
    "Build a supportive community around my hobbies"
  ],
  health: [
    "Lose 20 pounds and maintain healthy weight",
    "Build muscle and improve strength",
    "Improve mental health and manage stress",
    "Learn yoga and practice regularly",
    "Quit smoking and develop healthy habits",
    "Improve sleep quality and routine",
    "Learn about nutrition and meal planning",
    "Train for and complete a triathlon",
    "Develop better work-life balance",
    "Learn stress management techniques"
  ],
  financial: [
    "Save for a house down payment",
    "Learn investing and build portfolio",
    "Start a side business for extra income",
    "Pay off student loans completely",
    "Build an emergency fund",
    "Learn about cryptocurrency and trading",
    "Plan for early retirement (FIRE)",
    "Learn tax optimization strategies",
    "Improve credit score significantly",
    "Create multiple income streams"
  ]
};

// Enhanced group activities and purposes
const groupPurposes = [
  "Weekly skill-sharing sessions and workshops",
  "Monthly networking events and meetups",
  "Collaborative projects and team building",
  "Mentorship and career development support",
  "Regular practice sessions and skill development",
  "Community service and volunteer activities",
  "Social events and friendship building",
  "Professional development and education",
  "Creative collaboration and artistic projects",
  "Health and wellness support groups"
];

function getRandomItem<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

function getRandomItems<T>(array: T[], count: number): T[] {
  const shuffled = [...array].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}

export async function seedEnhancedData() {
  console.log("🚀 Starting enhanced comprehensive data seeding...");
  
  try {
    // Get current data counts
    const currentUsers = await db.select().from(users);
    const currentGroups = await db.select().from(groups);
    
    console.log(`📊 Current data: ${currentUsers.length} users, ${currentGroups.length} groups`);
    
    // Add wishes to existing users (this is crucial for AI suggestions to work)
    console.log("🎯 Adding wishes to users for AI-powered suggestions...");
    
    let wishesAdded = 0;
    for (const user of currentUsers) {
      // Check if user already has wishes
      const existingWishes = await db.select().from(wishes).where(eq(wishes.userId, user.id));
      
      if (existingWishes.length === 0) {
        // Add 3-7 wishes per user across different categories
        const wishCount = Math.floor(Math.random() * 5) + 3;
        const allWishes = [
          ...wishCategories.career,
          ...wishCategories.personal,
          ...wishCategories.creative,
          ...wishCategories.social,
          ...wishCategories.health,
          ...wishCategories.financial
        ];
        
        const userWishes = getRandomItems(allWishes, wishCount);
        
        for (let i = 0; i < userWishes.length; i++) {
          const wish = userWishes[i];
          const category = Object.keys(wishCategories).find(cat => 
            wishCategories[cat as keyof typeof wishCategories].includes(wish)
          ) || "personal";
          
          await db.insert(wishes).values({
            userId: user.id,
            title: wish,
            description: `I want to ${wish.toLowerCase()} to improve my life and achieve my goals.`,
            priority: ["urgent", "high", "medium", "low"][Math.floor(Math.random() * 4)],
            status: "active",
          });
          
          wishesAdded++;
        }
      }
    }
    
    console.log(`✅ Added ${wishesAdded} wishes to users`);
    
    // Add efficient group memberships (batch approach)
    console.log("👥 Enhancing group memberships...");
    
    let membershipsAdded = 0;
    // Process only first 50 groups for efficiency
    const groupsToProcess = currentGroups.slice(0, 50);
    
    for (const group of groupsToProcess) {
      // Add 3-8 random members per group
      const membersToAdd = Math.floor(Math.random() * 6) + 3;
      const randomUsers = getRandomItems(currentUsers, membersToAdd);
      
      for (const user of randomUsers) {
        try {
          await db.insert(groupMemberships).values({
            groupId: group.id,
            userId: user.id,
            role: Math.random() > 0.95 ? "admin" : "member",
          });
          membershipsAdded++;
        } catch (error) {
          // Ignore duplicate membership errors
        }
      }
    }
    
    console.log(`✅ Added ${membershipsAdded} group memberships`);
    
    // Create some initial matches between compatible users
    console.log("💝 Creating initial user matches...");
    
    let matchesCreated = 0;
    const usersWithProfiles = await db.select({
      user: users,
      profile: profiles
    }).from(users)
      .leftJoin(profiles, eq(users.id, profiles.userId))
      .limit(50); // Process first 50 users for initial matches
    
    for (let i = 0; i < usersWithProfiles.length; i++) {
      const user1 = usersWithProfiles[i];
      if (!user1.profile) continue;
      
      // Find 2-3 potential matches for each user
      for (let j = i + 1; j < Math.min(i + 10, usersWithProfiles.length); j++) {
        const user2 = usersWithProfiles[j];
        if (!user2.profile) continue;
        
        // Check if match already exists
        const existingMatch = await db.select().from(matches)
          .where(
            or(
              and(eq(matches.userId1, user1.user.id), eq(matches.userId2, user2.user.id)),
              and(eq(matches.userId1, user2.user.id), eq(matches.userId2, user1.user.id))
            )
          );
        
        if (existingMatch.length === 0 && Math.random() > 0.7) { // 30% chance of match
          // Create mutual matches
          await db.insert(matches).values({
            userId1: user1.user.id,
            userId2: user2.user.id,
            compatibilityScore: Math.floor(Math.random() * 30) + 70, // 70-100% compatibility
            status: "pending",
          });
          
          await db.insert(matches).values({
            userId1: user2.user.id,
            userId2: user1.user.id,
            compatibilityScore: Math.floor(Math.random() * 30) + 70,
            status: "pending",
          });
          
          matchesCreated += 2;
          
          if (matchesCreated >= 100) break; // Limit initial matches
        }
      }
      
      if (matchesCreated >= 100) break;
    }
    
    console.log(`✅ Created ${matchesCreated} initial matches`);
    
    // Add some AI-generated suggestions for testing
    console.log("🤖 Creating sample AI suggestions...");
    
    let suggestionsCreated = 0;
    const sampleSuggestions = [
      "Join the 'Tech Entrepreneurs Network' group to connect with like-minded innovators",
      "Connect with Sarah Johnson - you both share interests in data science and machine learning",
      "Check out the 'Photography Enthusiasts' group for your creative hobby development",
      "Consider connecting with Mike Chen who also wants to learn Spanish",
      "The 'Fitness Fanatics' group would be perfect for your health and wellness goals",
    ];
    
    for (let i = 0; i < Math.min(50, currentUsers.length); i++) {
      const user = currentUsers[i];
      const suggestion = getRandomItem(sampleSuggestions);
      
      try {
        await db.insert(suggestions).values({
          userId: user.id,
          targetType: Math.random() > 0.5 ? "user" : "group",
          targetId: currentUsers[Math.floor(Math.random() * currentUsers.length)].id,
          reason: suggestion,
          score: Math.floor(Math.random() * 30) + 70, // 70-100% relevance
          status: "pending",
        });
        suggestionsCreated++;
      } catch (error) {
        // Ignore errors
      }
    }
    
    console.log(`✅ Created ${suggestionsCreated} AI suggestions`);
    
    // Final comprehensive stats
    const finalStats = {
      users: await db.select().from(users).then(r => r.length),
      groups: await db.select().from(groups).then(r => r.length),
      skills: await db.select().from(skills).then(r => r.length),
      interests: await db.select().from(interestsTable).then(r => r.length),
      wishes: await db.select().from(wishes).then(r => r.length),
      matches: await db.select().from(matches).then(r => r.length),
      memberships: await db.select().from(groupMemberships).then(r => r.length),
      suggestions: await db.select().from(suggestions).then(r => r.length),
    };
    
    console.log("🎉 Enhanced data seeding completed!");
    console.log(`📈 Final comprehensive stats:`);
    console.log(`   👥 Users: ${finalStats.users}`);
    console.log(`   🏢 Groups: ${finalStats.groups}`);
    console.log(`   🎯 Wishes: ${finalStats.wishes}`);
    console.log(`   🤝 Matches: ${finalStats.matches}`);
    console.log(`   👫 Group Memberships: ${finalStats.memberships}`);
    console.log(`   🔧 Skills: ${finalStats.skills}`);
    console.log(`   ❤️ Interests: ${finalStats.interests}`);
    console.log(`   🤖 AI Suggestions: ${finalStats.suggestions}`);
    
  } catch (error) {
    console.error("❌ Error in enhanced data seeding:", error);
    throw error;
  }
}