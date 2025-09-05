import { db } from "./db";
import { users, profiles, skills, interests, groups, matches, suggestions } from "@shared/schema";

export async function seedMockData() {
  try {
    console.log("Seeding mock data...");
    
    // Clear existing matches and suggestions to prevent duplicates
    await db.delete(matches);
    await db.delete(groupSuggestions);

    // Create mock users
    const mockUsers = [
      {
        id: "user_1",
        email: "alice.chen@example.com",
        firstName: "Alice",
        lastName: "Chen",
        profileImageUrl: "https://images.unsplash.com/photo-1494790108755-2616b612b372?w=400&h=400&fit=crop&crop=face"
      },
      {
        id: "user_2", 
        email: "bob.martinez@example.com",
        firstName: "Bob",
        lastName: "Martinez",
        profileImageUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop&crop=face"
      },
      {
        id: "user_3",
        email: "sophia.kim@example.com", 
        firstName: "Sophia",
        lastName: "Kim",
        profileImageUrl: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400&h=400&fit=crop&crop=face"
      },
      {
        id: "user_4",
        email: "david.wilson@example.com",
        firstName: "David", 
        lastName: "Wilson",
        profileImageUrl: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400&h=400&fit=crop&crop=face"
      },
      {
        id: "user_5",
        email: "emma.garcia@example.com",
        firstName: "Emma",
        lastName: "Garcia", 
        profileImageUrl: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=400&h=400&fit=crop&crop=face"
      }
    ];

    // Insert users
    for (const user of mockUsers) {
      await db.insert(users).values(user).onConflictDoNothing();
    }

    // Create mock profiles
    const mockProfiles = [
      {
        userId: "user_1",
        bio: "Passionate software engineer with love for AI and machine learning. Always eager to learn new technologies and solve complex problems.",
        location: "San Francisco, CA",
        searchRadius: 50,
        jobTitle: "Senior Software Engineer",
        company: "TechCorp"
      },
      {
        userId: "user_2", 
        bio: "Creative designer and photographer. Love exploring nature and capturing beautiful moments through my lens.",
        location: "Los Angeles, CA",
        searchRadius: 75,
        jobTitle: "UX Designer",
        company: "Creative Studio"
      },
      {
        userId: "user_3",
        bio: "Data scientist passionate about using analytics to drive business decisions. Enjoy hiking and rock climbing in my free time.",
        location: "Seattle, WA", 
        searchRadius: 100,
        jobTitle: "Data Scientist",
        company: "Analytics Inc"
      },
      {
        userId: "user_4",
        bio: "Product manager with experience building consumer apps. Love cooking, traveling, and discovering new cultures.",
        location: "New York, NY",
        searchRadius: 25,
        jobTitle: "Product Manager", 
        company: "StartupCo"
      },
      {
        userId: "user_5",
        bio: "Marketing specialist focused on digital campaigns and brand growth. Passionate about fitness and wellness.",
        location: "Austin, TX",
        searchRadius: 60,
        jobTitle: "Marketing Manager",
        company: "Growth Agency"
      }
    ];

    // Insert profiles
    for (const profile of mockProfiles) {
      await db.insert(profiles).values(profile).onConflictDoNothing();
    }

    // Create mock skills
    const mockSkills = [
      { userId: "user_1", name: "JavaScript", level: "expert", category: "technical" },
      { userId: "user_1", name: "Python", level: "advanced", category: "technical" },
      { userId: "user_1", name: "Machine Learning", level: "intermediate", category: "technical" },
      { userId: "user_2", name: "UI/UX Design", level: "expert", category: "creative" },
      { userId: "user_2", name: "Photography", level: "advanced", category: "creative" },
      { userId: "user_2", name: "Adobe Creative Suite", level: "expert", category: "technical" },
      { userId: "user_3", name: "Data Analysis", level: "expert", category: "technical" },
      { userId: "user_3", name: "SQL", level: "advanced", category: "technical" },
      { userId: "user_3", name: "Rock Climbing", level: "intermediate", category: "sports" },
      { userId: "user_4", name: "Product Strategy", level: "advanced", category: "business" },
      { userId: "user_4", name: "User Research", level: "intermediate", category: "business" },
      { userId: "user_4", name: "Cooking", level: "advanced", category: "creative" },
      { userId: "user_5", name: "Digital Marketing", level: "expert", category: "business" },
      { userId: "user_5", name: "Content Creation", level: "advanced", category: "creative" },
      { userId: "user_5", name: "Fitness Training", level: "intermediate", category: "sports" }
    ];

    // Insert skills
    for (const skill of mockSkills) {
      await db.insert(skills).values(skill).onConflictDoNothing();
    }

    // Create mock hobbies  
    const mockHobbies = [
      { userId: "user_1", name: "Chess", intensity: "passionate", category: "games" },
      { userId: "user_1", name: "Reading", intensity: "regular", category: "education" },
      { userId: "user_2", name: "Hiking", intensity: "passionate", category: "outdoor" },
      { userId: "user_2", name: "Photography", intensity: "passionate", category: "creative" },
      { userId: "user_3", name: "Rock Climbing", intensity: "passionate", category: "sports" },
      { userId: "user_3", name: "Camping", intensity: "regular", category: "outdoor" },
      { userId: "user_4", name: "Traveling", intensity: "passionate", category: "adventure" },
      { userId: "user_4", name: "Cooking", intensity: "regular", category: "creative" },
      { userId: "user_5", name: "Yoga", intensity: "regular", category: "wellness" },
      { userId: "user_5", name: "Running", intensity: "passionate", category: "sports" }
    ];

    // Insert hobbies
    for (const hobby of mockHobbies) {
      await db.insert(hobbies).values(hobby).onConflictDoNothing();
    }

    // Create mock groups
    const mockGroups = [
      {
        id: "group_1",
        name: "SF Tech Meetup",
        description: "A community for software engineers and tech enthusiasts in San Francisco. We meet monthly to discuss latest technologies, share projects, and network.",
        category: "Technology",
        location: "San Francisco, CA", 
        memberCount: 150,
        maxMembers: 200,
        isPublic: true,
        createdBy: "user_1"
      },
      {
        id: "group_2",
        name: "Bay Area Photographers",
        description: "Photography enthusiasts exploring the beautiful landscapes around San Francisco Bay. Weekly photo walks and monthly workshops.",
        category: "Photography",
        location: "San Francisco, CA",
        memberCount: 85,
        maxMembers: 100,
        isPublic: true,
        createdBy: "user_2"
      },
      {
        id: "group_3", 
        name: "Data Science Collective",
        description: "Data scientists and analysts sharing insights, best practices, and collaborating on projects. Regular talks by industry experts.",
        category: "Data Science",
        location: "Seattle, WA",
        memberCount: 120,
        maxMembers: 150,
        isPublic: true,
        createdBy: "user_3"
      },
      {
        id: "group_4",
        name: "Outdoor Adventure Club",
        description: "Love the outdoors? Join us for hiking, camping, rock climbing, and other adventures. All skill levels welcome!",
        category: "Outdoor",
        location: "San Francisco, CA",
        memberCount: 75,
        maxMembers: 100,
        isPublic: true,
        createdBy: "user_2"
      },
      {
        id: "group_5",
        name: "Product Management Network", 
        description: "Product managers sharing experiences, best practices, and career advice. Monthly meetups with guest speakers from top companies.",
        category: "Business",
        location: "San Francisco, CA",
        memberCount: 95,
        maxMembers: 120,
        isPublic: true,
        createdBy: "user_4"
      }
    ];

    // Insert groups
    for (const group of mockGroups) {
      await db.insert(groups).values(group).onConflictDoNothing();
    }

    // Create matches with varying ages for historical data
    const currentUserId = "38523780"; // This is the current logged-in user
    const now = new Date();
    const sampleMatches = [
      // Recent matches (within last hour - will show as "New")  
      {
        userId1: currentUserId,
        userId2: "user_1",
        compatibilityScore: 92,
        matchReason: "Shared passion technology and AI, similar location in Bay Area, both love problem-solving and continuous learning",
        status: "pending",
        createdAt: new Date(now.getTime() - 30 * 60 * 1000) // 30 minutes ago
      },
      {
        userId1: currentUserId,
        userId2: "user_3",
        compatibilityScore: 88,
        matchReason: "Both data enthusiasts with love for analytics, outdoor activities like hiking, and growth mindset",
        status: "pending",
        createdAt: new Date(now.getTime() - 45 * 60 * 1000) // 45 minutes ago
      },
      
      // Historical matches (older)
      {
        userId1: currentUserId,
        userId2: "user_4",
        compatibilityScore: 85,
        matchReason: "Product-focused professionals with love for travel and exploring new cultures, similar business acumen",
        status: "pending",
        createdAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000) // 2 days ago
      },
      {
        userId1: currentUserId,
        userId2: "user_2",
        compatibilityScore: 78,
        matchReason: "Creative professionals with shared interest in design and photography",
        status: "connected",
        createdAt: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000) // 5 days ago
      },
      {
        userId1: currentUserId,
        userId2: "user_5",
        compatibilityScore: 82,
        matchReason: "Both love outdoor adventures and have similar professional backgrounds",
        status: "pending",
        createdAt: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) // 1 week ago
      },
      {
        userId1: currentUserId,
        userId2: "user_1",
        compatibilityScore: 89,
        matchReason: "Strong alignment in career goals and technical interests",
        status: "dismissed",
        createdAt: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000) // 10 days ago
      },
      {
        userId1: currentUserId,
        userId2: "user_3",
        compatibilityScore: 91,
        matchReason: "Excellent match for professional networking and shared hobbies",
        status: "connected",
        createdAt: new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000) // 2 weeks ago
      },
      {
        userId1: currentUserId,
        userId2: "user_4",
        compatibilityScore: 76,
        matchReason: "Similar interests in technology and outdoor activities",
        status: "pending",
        createdAt: new Date(now.getTime() - 21 * 24 * 60 * 60 * 1000) // 3 weeks ago
      }
    ];

    // Insert sample matches
    for (const match of sampleMatches) {
      await db.insert(matches).values(match).onConflictDoNothing();
    }

    // Create sample group suggestions with varying ages for historical data
    const sampleGroupSuggestions = [
      // Recent suggestions (will show as "New")
      {
        userId: currentUserId,
        groupId: "group_1",
        score: 95,
        reason: "Perfect match for your tech background and San Francisco location",
        createdAt: new Date(now.getTime() - 20 * 60 * 1000) // 20 minutes ago
      },
      {
        userId: currentUserId,
        groupId: "group_4",
        score: 88,
        reason: "Great for exploring your outdoor interests and meeting like-minded adventurers",
        createdAt: new Date(now.getTime() - 50 * 60 * 1000) // 50 minutes ago
      },
      
      // Historical suggestions
      {
        userId: currentUserId,
        groupId: "group_5",
        score: 82,
        reason: "Excellent networking opportunity for business and product development",
        createdAt: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000) // 3 days ago
      },
      {
        userId: currentUserId,
        groupId: "group_2",
        score: 87,
        reason: "Great for startup enthusiasts and entrepreneurship learning",
        createdAt: new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000) // 6 days ago
      },
      {
        userId: currentUserId,
        groupId: "group_3",
        score: 84,
        reason: "Perfect for data science professionals looking to network and learn",
        createdAt: new Date(now.getTime() - 12 * 24 * 60 * 60 * 1000) // 12 days ago
      }
    ];

    // Insert sample group suggestions
    for (const suggestion of sampleGroupSuggestions) {
      await db.insert(groupSuggestions).values(suggestion).onConflictDoNothing();
    }

    console.log("Mock data with matches and suggestions seeded successfully!");
    
  } catch (error) {
    console.error("Error seeding mock data:", error);
  }
}