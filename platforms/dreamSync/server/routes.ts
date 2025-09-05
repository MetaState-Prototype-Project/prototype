import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./auth";
import { seedExtensiveData } from "./seedExtensiveData";
import { seedComprehensiveData } from "./seedComprehensiveData";
import { seedEnhancedData } from "./seedEnhancedData";
import { fixUserPasswords } from "./fixPasswords";
import { ensureFullyPopulatedData } from "./ensureFullyPopulatedData";
import { generateTestSuggestions } from "./generateTestSuggestions";
// Removed old aiMatchingService - now using aiSuggestionsService only
import { analyzeNewWish, analyzeDailyWishesBatch } from "./aiSuggestionsService";
import { findMatchesFromDatabase } from "./openai";
import { db } from "./db";
import { 
  users,
  profiles,
  skills,
  interests,
  wishes,
  wishUserSuggestions,
  wishGroupSuggestions,
  matches,
  groups,
  groupMemberships,
  suggestions,
  insertProfileSchema,
  insertSkillSchema,
  insertInterestSchema,
  insertWishSchema,
  insertGroupSchema,
} from "@shared/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { z } from "zod";

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3959; // Earth's radius in miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Seed extensive test data on startup
  await seedExtensiveData();
  // Seed comprehensive additional data (will skip if already sufficient)
  try {
    await seedComprehensiveData();
  } catch (error) {
    console.error("Warning: Failed to seed comprehensive data:", (error as Error).message);
  }
  
  // Fix user passwords for authentication
  try {
    await fixUserPasswords();
  } catch (error) {
    console.error("Warning: Failed to fix user passwords:", (error as Error).message);
  }
  
  // Ensure fully populated data for comprehensive testing
  try {
    await ensureFullyPopulatedData();
  } catch (error) {
    console.error("Warning: Failed to ensure fully populated data:", (error as Error).message);
  }
  
  // Generate comprehensive test suggestions
  try {
    await generateTestSuggestions();
  } catch (error) {
    console.error("Warning: Failed to generate test suggestions:", (error as Error).message);
  }
  
  // Auth middleware
  setupAuth(app);

  // Auth routes
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Profile routes
  app.get('/api/profile', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const userWithProfile = await storage.getUserWithProfile(userId);
      res.json(userWithProfile);
    } catch (error) {
      console.error("Error fetching profile:", error);
      res.status(500).json({ message: "Failed to fetch profile" });
    }
  });

  app.post('/api/profile', isAuthenticated, async (req: any, res) => {
    try {
      console.log("Profile save request received from user:", req.user?.claims?.sub);
      console.log("Profile data received:", req.body);
      
      const userId = req.user.id;
      const profileData = insertProfileSchema.parse({ ...req.body, userId });
      
      console.log("Parsed profile data:", profileData);
      
      const existingUser = await storage.getUserWithProfile(userId);
      let profile;
      
      if (existingUser?.profile) {
        console.log("Updating existing profile");
        profile = await storage.updateProfile(userId, profileData);
      } else {
        console.log("Creating new profile");
        profile = await storage.createProfile(profileData);
      }
      
      console.log("Profile operation successful");
      res.json(profile);
    } catch (error) {
      console.error("Error creating/updating profile:", error);
      res.status(400).json({ message: "Invalid profile data", error: error instanceof Error ? error.message : "Unknown error" });
    }
  });

  // Skills routes
  app.get('/api/skills', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const skills = await storage.getUserSkills(userId);
      res.json(skills);
    } catch (error) {
      console.error("Error fetching skills:", error);
      res.status(500).json({ message: "Failed to fetch skills" });
    }
  });

  app.post('/api/skills', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const skillData = insertSkillSchema.parse({ ...req.body, userId, category: req.body.category || "other" });
      const skill = await storage.createSkill(skillData);
      res.json(skill);
    } catch (error) {
      console.error("Error creating skill:", error);
      res.status(400).json({ message: "Invalid skill data" });
    }
  });

  app.delete('/api/skills/:id', isAuthenticated, async (req: any, res) => {
    try {
      await storage.deleteSkill(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting skill:", error);
      res.status(500).json({ message: "Failed to delete skill" });
    }
  });

  // Interests routes (replaces hobbies and habits)
  app.get('/api/interests', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const interests = await storage.getUserInterests(userId);
      res.json(interests);
    } catch (error) {
      console.error("Error fetching interests:", error);
      res.status(500).json({ message: "Failed to fetch interests" });
    }
  });

  app.post('/api/interests', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      console.log("Creating interest with data:", { ...req.body, userId });
      const interestData = insertInterestSchema.parse({ ...req.body, userId });
      const interest = await storage.createInterest(interestData);
      console.log("Created interest:", interest);
      res.json(interest);
    } catch (error) {
      console.error("Error creating interest:", error);
      res.status(400).json({ message: "Invalid interest data" });
    }
  });

  app.delete('/api/interests/:id', isAuthenticated, async (req: any, res) => {
    try {
      await storage.deleteInterest(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting interest:", error);
      res.status(500).json({ message: "Failed to delete interest" });
    }
  });



  // Wishlist routes
  app.get('/api/wishlist', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const wishlistItems = await storage.getUserWishlistItems(userId);
      res.json(wishlistItems);
    } catch (error) {
      console.error("Error fetching wishlist:", error);
      res.status(500).json({ message: "Failed to fetch wishlist" });
    }
  });

  app.get('/api/wishlist/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const wishlistItem = await storage.getWishlistItem(req.params.id, userId);
      
      if (!wishlistItem) {
        return res.status(404).json({ message: "Wishlist item not found" });
      }
      
      res.json(wishlistItem);
    } catch (error) {
      console.error("Error fetching wishlist item:", error);
      res.status(500).json({ message: "Failed to fetch wishlist item" });
    }
  });

  app.post('/api/wishlist', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const wishlistData = insertWishSchema.parse({ ...req.body, userId });
      
      // Create the wish first
      const wishlistItem = await storage.createWishlistItem(wishlistData);
      
      // Then analyze it with AI to find relevant users and groups
      console.log("Starting AI analysis for wishlist item:", wishlistItem.id);
      
      // TRIGGER IMMEDIATE AI ANALYSIS FOR NEW WISH (Occasion 1: New wish created)
      setImmediate(async () => {
        try {
          await analyzeNewWish(wishlistItem.id, userId);
          console.log("✅ New wish AI analysis completed:", wishlistItem.title);
        } catch (analysisError) {
          console.error("❌ New wish AI analysis failed:", analysisError);
        }
      });
      
      res.json(wishlistItem);
    } catch (error) {
      console.error("Error creating wishlist item:", error);
      res.status(400).json({ message: "Invalid wishlist data" });
    }
  });

  app.put('/api/wishlist/:id', isAuthenticated, async (req: any, res) => {
    try {
      const updateData = insertWishSchema.partial().parse(req.body);
      const wishlistItem = await storage.updateWishlistItem(req.params.id, updateData);
      res.json(wishlistItem);
    } catch (error) {
      console.error("Error updating wishlist item:", error);
      res.status(400).json({ message: "Invalid wishlist data" });
    }
  });

  app.delete('/api/wishlist/:id', isAuthenticated, async (req: any, res) => {
    try {
      await storage.deleteWishlistItem(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting wishlist item:", error);
      res.status(500).json({ message: "Failed to delete wishlist item" });
    }
  });

  // Legacy test route removed - using new file-based AI analysis

  // Get suggestions for a specific wish
  app.get('/api/wishlist/:id/suggestions', isAuthenticated, async (req: any, res) => {
    try {
      const wishId = req.params.id;
      const suggestions = await storage.getWishSuggestions(wishId);
      res.json(suggestions);
    } catch (error) {
      console.error("Error fetching wish suggestions:", error);
      res.status(500).json({ message: "Failed to fetch wish suggestions" });
    }
  });

  // Get all unique skills for searchable dropdown
  app.get('/api/skills/all', isAuthenticated, async (req: any, res) => {
    try {
      const skills = await storage.getAllUniqueSkills();
      res.json(skills);
    } catch (error) {
      console.error("Error fetching all skills:", error);
      res.status(500).json({ message: "Failed to fetch skills" });
    }
  });

  // Get all unique interests for searchable dropdown
  app.get('/api/interests/all', isAuthenticated, async (req: any, res) => {
    try {
      const interests = await storage.getAllUniqueInterests();
      res.json(interests);
    } catch (error) {
      console.error("Error fetching all interests:", error);
      res.status(500).json({ message: "Failed to fetch interests" });
    }
  });

  // NEW: Database-based match search using AI file analysis
  app.post('/api/matches/find', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { radius, selectedSkills, selectedInterests, searchQuery, minCompatibility } = req.body;
      
      console.log(`🔍 Starting database-based match search for user ${userId}`);
      console.log(`Search criteria:`, { radius, selectedSkills, selectedInterests, searchQuery });

      // Use the new AI-powered database search
      const searchResults = await findMatchesFromDatabase(userId, {
        radius,
        selectedSkills,
        selectedInterests,
        searchQuery
      });

      // Create matches in database for users that meet criteria
      const newMatches = [];
      const minimumScore = minCompatibility || 60;

      // Get all valid user IDs for validation
      const allUsers = await db.select({ id: users.id }).from(users);
      const validUserIds = new Set(allUsers.map(u => u.id));

      for (const userMatch of searchResults.userMatches) {
        if (userMatch.relevanceScore >= minimumScore) {
          // Validate that the user ID actually exists in our database
          if (!validUserIds.has(userMatch.userId)) {
            console.log(`⚠️ Skipping invalid user ID: ${userMatch.userId}`);
            continue;
          }
          
          // Check if match already exists
          const existingMatch = await storage.getExistingMatch(userId, userMatch.userId);
          if (!existingMatch) {
            const match = await storage.createMatch(
              userId,
              userMatch.userId,
              userMatch.relevanceScore,
              userMatch.reason
            );
            newMatches.push(match);
          }
        }
      }

      // Also return group matches for display (with validation)
      const allGroups = await db.select({ id: groups.id }).from(groups);
      const validGroupIds = new Set(allGroups.map(g => g.id));
      
      const relevantGroups = searchResults.groupMatches.filter(group => {
        if (group.relevanceScore >= minimumScore) {
          if (!validGroupIds.has(group.groupId)) {
            console.log(`⚠️ Skipping invalid group ID: ${group.groupId}`);
            return false;
          }
          return true;
        }
        return false;
      });

      res.json({
        message: `Found ${newMatches.length} new user matches and ${relevantGroups.length} relevant groups`,
        matchCount: newMatches.length,
        matches: newMatches,
        groupSuggestions: relevantGroups,
        searchResults: {
          userMatches: searchResults.userMatches,
          groupMatches: searchResults.groupMatches
        }
      });
    } catch (error) {
      console.error("Error finding matches:", error);
      res.status(500).json({ message: "Failed to find matches" });
    }
  });

  app.get('/api/matches', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const matches = await storage.getUserMatches(userId);
      // Limit to 20 matches for faster loading
      const limitedMatches = matches.slice(0, 20);
      res.json(limitedMatches);
    } catch (error) {
      console.error("Error fetching matches:", error);
      res.status(500).json({ message: "Failed to fetch matches" });
    }
  });

  app.put('/api/matches/:id/status', isAuthenticated, async (req: any, res) => {
    try {
      const { status } = req.body;
      const match = await storage.updateMatchStatus(req.params.id, status);
      res.json(match);
    } catch (error) {
      console.error("Error updating match status:", error);
      res.status(500).json({ message: "Failed to update match status" });
    }
  });

  app.delete('/api/matches/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      await storage.deleteMatch(req.params.id, userId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting match:", error);
      res.status(500).json({ message: "Failed to delete match" });
    }
  });

  // Groups routes
  app.get('/api/groups', async (req, res) => {
    try {
      const groups = await storage.getGroups();
      res.json(groups);
    } catch (error) {
      console.error("Error fetching groups:", error);
      res.status(500).json({ message: "Failed to fetch groups" });
    }
  });

  app.post('/api/groups', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const groupData = insertGroupSchema.parse({ ...req.body, createdBy: userId });
      const group = await storage.createGroup(groupData);
      res.json(group);
    } catch (error) {
      console.error("Error creating group:", error);
      res.status(400).json({ message: "Invalid group data" });
    }
  });

  app.post('/api/groups/:id/join', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const groupId = req.params.id;
      const membership = await storage.joinGroup(groupId, userId);
      res.json(membership);
    } catch (error) {
      console.error("Error joining group:", error);
      res.status(500).json({ message: "Failed to join group" });
    }
  });

  app.delete('/api/groups/:id/leave', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const groupId = req.params.id;
      await storage.leaveGroup(groupId, userId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error leaving group:", error);
      res.status(500).json({ message: "Failed to leave group" });
    }
  });

  app.get('/api/user/groups', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const userGroups = await storage.getUserGroups(userId);
      res.json(userGroups);
    } catch (error) {
      console.error("Error fetching user groups:", error);
      res.status(500).json({ message: "Failed to fetch user groups" });
    }
  });

  // Wishlist-based suggestions + external matches
  app.get('/api/suggestions', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      
      console.log(`📋 Fetching wishlist-based suggestions for user ${userId}`);
      
      // Get user's wishes to find related suggestions
      const userWishes = await db
        .select()
        .from(wishes)
        .where(eq(wishes.userId, userId))
        .orderBy(desc(wishes.createdAt));
      
      if (userWishes.length === 0) {
        console.log("❌ No wishes found for user, returning empty suggestions");
        return res.json([]);
      }
      
      const allSuggestions = [];
      
      // Get wishlist-based user suggestions
      for (const wish of userWishes) {
        const userSuggestions = await db
          .select({
            suggestion: wishUserSuggestions,
            user: users,
            profile: profiles,
          })
          .from(wishUserSuggestions)
          .leftJoin(users, eq(wishUserSuggestions.userId, users.id))
          .leftJoin(profiles, eq(users.id, profiles.userId))
          .where(eq(wishUserSuggestions.wishId, wish.id))
          .orderBy(desc(wishUserSuggestions.relevanceScore))
          .limit(5);
        
        // Add user suggestions with skills and interests
        for (const item of userSuggestions) {
          if (!item.user) continue;
          
          const [userSkills, userInterests] = await Promise.all([
            db.select().from(skills).where(eq(skills.userId, item.user.id)),
            db.select().from(interests).where(eq(interests.userId, item.user.id))
          ]);
          
          allSuggestions.push({
            id: item.suggestion.id,
            targetType: 'user',
            reason: `${item.suggestion.reason} (for "${wish.title}")`,
            score: item.suggestion.relevanceScore,
            wishTitle: wish.title,
            user: {
              ...item.user,
              profile: item.profile,
              skills: userSkills,
              interests: userInterests,
            }
          });
        }
        
        // Get wishlist-based group suggestions
        const groupSuggestions = await db
          .select({
            suggestion: wishGroupSuggestions,
            group: groups,
          })
          .from(wishGroupSuggestions)
          .leftJoin(groups, eq(wishGroupSuggestions.groupId, groups.id))
          .where(eq(wishGroupSuggestions.wishId, wish.id))
          .orderBy(desc(wishGroupSuggestions.relevanceScore))
          .limit(3);
          
        // Add group suggestions
        for (const item of groupSuggestions) {
          if (!item.group) continue;
          
          allSuggestions.push({
            id: item.suggestion.id,
            targetType: 'group',
            reason: `${item.suggestion.reason} (for "${wish.title}")`,
            score: item.suggestion.relevanceScore,
            wishTitle: wish.title,
            group: item.group
          });
        }
      }
      
      // REMOVED: External matches no longer included in suggestions
      // Suggestions are now ONLY AI-generated wishlist-based recommendations
      // All match data (including external matches) is accessed via /api/matches
      
      // Sort by score and limit results
      const sortedSuggestions = allSuggestions
        .sort((a, b) => b.score - a.score)
        .slice(0, 20);
      
      console.log(`✅ Found ${sortedSuggestions.length} total suggestions (${allSuggestions.filter(s => s.targetType === 'user').length} users, ${allSuggestions.filter(s => s.targetType === 'group').length} groups, 0 external matches)`);
      
      res.json(sortedSuggestions);
    } catch (error) {
      console.error("Error fetching suggestions:", error);
      res.status(500).json({ message: "Failed to fetch suggestions" });
    }
  });

  // Group suggestions - only fetch stored suggestions
  app.get('/api/group-suggestions', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const suggestions = await storage.getUserGroupSuggestions(userId);
      // Limit to 10 suggestions for faster loading
      const limitedSuggestions = suggestions.slice(0, 10);
      res.json(limitedSuggestions);
    } catch (error) {
      console.error("Error fetching group suggestions:", error);
      res.status(500).json({ message: "Failed to fetch group suggestions" });
    }
  });

  // Dashboard initialization - DAILY BATCH ANALYSIS (Occasion 2: Every 24 hours)
  app.post('/api/dashboard/initialize', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      
      // Check if user has wishes
      const userWishes = await db
        .select()
        .from(wishes)
        .where(eq(wishes.userId, userId));
      
      if (userWishes.length === 0) {
        return res.json({ message: "No wishes found - add some wishes to get AI suggestions" });
      }
      
      // Check if daily batch analysis is needed (every 24 hours)
      const now = new Date();
      const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      
      // Check if any suggestions exist from the last 24 hours
      const recentSuggestions = await db
        .select()
        .from(wishUserSuggestions)
        .where(sql`${wishUserSuggestions.createdAt} > ${twentyFourHoursAgo}`)
        .limit(1);
      
      if (recentSuggestions.length === 0) {
        console.log(`🕐 Starting daily batch analysis for user ${userId} (${userWishes.length} wishes)`);
        
        // RUN DAILY BATCH ANALYSIS FOR ALL WISHES (Occasion 2: Every 24 hours)
        setTimeout(async () => {
          try {
            await analyzeDailyWishesBatch(userId);
            console.log(`✅ Completed daily batch analysis for user ${userId}`);
          } catch (analysisError) {
            console.error("❌ Daily batch analysis failed:", analysisError);
          }
        }, 5000); // 5 second delay
        
        res.json({ 
          message: "Dashboard initialized - daily batch analysis started",
          totalWishes: userWishes.length,
          analysisType: "daily_batch"
        });
      } else {
        res.json({ 
          message: "Dashboard ready - recent suggestions available",
          totalWishes: userWishes.length,
          analysisType: "recent_available"
        });
      }
    } catch (error) {
      console.error("Error initializing dashboard:", error);
      res.status(500).json({ message: "Failed to initialize dashboard" });
    }
  });

  app.delete('/api/group-suggestions/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      await storage.deleteGroupSuggestion(req.params.id, userId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting group suggestion:", error);
      res.status(500).json({ message: "Failed to delete group suggestion" });
    }
  });

  app.put('/api/group-suggestions/:id/status', isAuthenticated, async (req: any, res) => {
    try {
      const { status } = req.body;
      const suggestion = await storage.updateGroupSuggestionStatus(req.params.id, status);
      res.json(suggestion);
    } catch (error) {
      console.error("Error updating group suggestion status:", error);
      res.status(500).json({ message: "Failed to update suggestion status" });
    }
  });

  // Analytics routes
  app.get('/api/stats', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const stats = await storage.getUserStats(userId);
      res.json(stats);
    } catch (error) {
      console.error("Error fetching stats:", error);
      res.status(500).json({ message: "Failed to fetch stats" });
    }
  });

  // Legacy AI routes removed - now using integrated file-based AI system

  const httpServer = createServer(app);
  return httpServer;
}
