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
  type User,
  type UpsertUser,
  type Profile,
  type InsertProfile,
  type Skill,
  type InsertSkill,
  type Interest,
  type InsertInterest,
  type Wish,
  type InsertWish,
  type WishUserSuggestion,
  type WishGroupSuggestion,
  type Match,
  type Group,
  type InsertGroup,
  type GroupMembership,
  type Suggestion,
  type UserWithProfile,
  type MatchWithUsers,
  type GroupWithMembers,
  // Legacy aliases
  type WishlistItem,
  type InsertWishlistItem,
  type GroupSuggestion,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, or, desc, asc, sql, inArray } from "drizzle-orm";

// Interface for storage operations
export interface IStorage {
  // User operations
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: UpsertUser): Promise<User>;
  upsertUser(user: UpsertUser): Promise<User>;
  
  // Profile operations
  getUserWithProfile(id: string): Promise<UserWithProfile | undefined>;
  createProfile(profile: InsertProfile): Promise<Profile>;
  updateProfile(userId: string, profile: Partial<InsertProfile>): Promise<Profile | undefined>;
  
  // Skills operations
  createSkill(skill: InsertSkill): Promise<Skill>;
  getUserSkills(userId: string): Promise<Skill[]>;
  deleteSkill(id: string): Promise<void>;
  getAllUniqueSkills(): Promise<{ name: string, count: number }[]>;
  
  // Interests operations (replaces hobbies and habits)
  createInterest(interest: InsertInterest): Promise<Interest>;
  getUserInterests(userId: string): Promise<Interest[]>;
  deleteInterest(id: string): Promise<void>;
  getAllUniqueInterests(): Promise<{ name: string, count: number }[]>;
  
  // Wishlist operations
  createWishlistItem(item: InsertWishlistItem): Promise<WishlistItem>;
  getUserWishlistItems(userId: string): Promise<WishlistItem[]>;
  getWishlistItem(id: string, userId: string): Promise<WishlistItem | undefined>;
  updateWishlistItem(id: string, item: Partial<InsertWishlistItem>): Promise<WishlistItem | undefined>;
  deleteWishlistItem(id: string): Promise<void>;
  getWishSuggestions(wishId: string): Promise<{ users: any[], groups: any[] }>;
  
  // Wish suggestion operations
  createWishUserSuggestion(wishId: string, userId: string, relevanceScore: number, reason: string): Promise<WishUserSuggestion>;
  createWishGroupSuggestion(wishId: string, groupId: string, relevanceScore: number, reason: string): Promise<WishGroupSuggestion>;
  
  // Match operations
  createMatch(userId1: string, userId2: string, score: number, reason: string): Promise<Match>;
  getUserMatches(userId: string): Promise<MatchWithUsers[]>;
  updateMatchStatus(matchId: string, status: string): Promise<Match | undefined>;
  deleteMatch(matchId: string, userId: string): Promise<void>;
  getExistingMatch(userId1: string, userId2: string): Promise<Match | undefined>;
  
  // Group operations
  createGroup(group: InsertGroup): Promise<Group>;
  getGroups(): Promise<GroupWithMembers[]>;
  getGroup(id: string): Promise<GroupWithMembers | undefined>;
  joinGroup(groupId: string, userId: string): Promise<GroupMembership>;
  leaveGroup(groupId: string, userId: string): Promise<void>;
  getUserGroups(userId: string): Promise<GroupWithMembers[]>;
  
  // Group suggestions (now using unified suggestions table)
  createGroupSuggestion(userId: string, groupId: string, reason: string, score: number): Promise<Suggestion>;
  getUserGroupSuggestions(userId: string): Promise<(Suggestion & { group: GroupWithMembers })[]>;
  updateGroupSuggestionStatus(suggestionId: string, status: string): Promise<Suggestion | undefined>;
  deleteGroupSuggestion(suggestionId: string, userId: string): Promise<void>;
  
  // Analytics
  getUserStats(userId: string): Promise<{
    totalMatches: number;
    newMatches: number;
    suggestedGroups: number;
  }>;
  
  // Utility functions for matching algorithm
  getAllUsersForMatching(excludeUserId: string): Promise<UserWithProfile[]>;
  updateProfileCompletion(userId: string): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async createUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .returning();
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  // Profile operations
  async getUserWithProfile(id: string): Promise<UserWithProfile | undefined> {
    const [user] = await db
      .select()
      .from(users)
      .leftJoin(profiles, eq(users.id, profiles.userId))
      .where(eq(users.id, id));

    if (!user) return undefined;

    // Batch fetch all related data
    const [userSkills, userInterests, userWishlistItems] = await Promise.all([
      this.getUserSkills(id),
      this.getUserInterests(id),
      this.getUserWishlistItems(id)
    ]);

    return {
      ...user.users,
      profile: user.profiles || undefined,
      skills: userSkills,
      interests: userInterests,
      wishlistItems: userWishlistItems,
    };
  }

  async createProfile(profile: InsertProfile): Promise<Profile> {
    const [newProfile] = await db
      .insert(profiles)
      .values(profile)
      .returning();
    
    await this.updateProfileCompletion(profile.userId);
    return newProfile;
  }

  async updateProfile(userId: string, profile: Partial<InsertProfile>): Promise<Profile | undefined> {
    const [updatedProfile] = await db
      .update(profiles)
      .set({ ...profile, updatedAt: new Date() })
      .where(eq(profiles.userId, userId))
      .returning();
    
    if (updatedProfile) {
      await this.updateProfileCompletion(userId);
    }
    
    return updatedProfile;
  }

  // Skills operations
  async createSkill(skill: InsertSkill): Promise<Skill> {
    const [newSkill] = await db.insert(skills).values(skill).returning();
    await this.updateProfileCompletion(skill.userId);
    return newSkill;
  }

  async getUserSkills(userId: string): Promise<Skill[]> {
    return await db.select().from(skills).where(eq(skills.userId, userId));
  }

  async deleteSkill(id: string): Promise<void> {
    const [skill] = await db.select().from(skills).where(eq(skills.id, id));
    await db.delete(skills).where(eq(skills.id, id));
    if (skill) {
      await this.updateProfileCompletion(skill.userId);
    }
  }

  // Interests operations (replaces hobbies and habits)
  async createInterest(interest: InsertInterest): Promise<Interest> {
    const [newInterest] = await db.insert(interests).values(interest).returning();
    await this.updateProfileCompletion(interest.userId);
    return newInterest;
  }

  async getUserInterests(userId: string): Promise<Interest[]> {
    return await db.select().from(interests).where(eq(interests.userId, userId));
  }

  async deleteInterest(id: string): Promise<void> {
    const [interest] = await db.select().from(interests).where(eq(interests.id, id));
    await db.delete(interests).where(eq(interests.id, id));
    if (interest) {
      await this.updateProfileCompletion(interest.userId);
    }
  }

  // Wishlist operations
  async createWishlistItem(item: InsertWish): Promise<Wish> {
    const [newItem] = await db.insert(wishes).values(item).returning();
    await this.updateProfileCompletion(item.userId);
    return newItem;
  }

  async getUserWishlistItems(userId: string): Promise<Wish[]> {
    return await db.select().from(wishes).where(eq(wishes.userId, userId));
  }

  async getWishlistItem(id: string, userId: string): Promise<Wish | undefined> {
    const [item] = await db
      .select()
      .from(wishes)
      .where(and(eq(wishes.id, id), eq(wishes.userId, userId)));
    return item;
  }

  async updateWishlistItem(id: string, item: Partial<InsertWish>): Promise<Wish | undefined> {
    const [updatedItem] = await db
      .update(wishes)
      .set(item)
      .where(eq(wishes.id, id))
      .returning();
    return updatedItem;
  }

  async getWishlistItem(id: string, userId: string): Promise<WishlistItem | undefined> {
    const [item] = await db
      .select()
      .from(wishes)
      .where(and(eq(wishes.id, id), eq(wishes.userId, userId)));
    return item;
  }

  async deleteWishlistItem(id: string): Promise<void> {
    const [item] = await db.select().from(wishes).where(eq(wishes.id, id));
    await db.delete(wishes).where(eq(wishes.id, id));
    if (item) {
      await this.updateProfileCompletion(item.userId);
    }
  }

  async getWishSuggestions(wishId: string): Promise<{ users: any[], groups: any[] }> {
    // Get user suggestions with user details
    const userSuggestions = await db
      .select({
        suggestion: wishUserSuggestions,
        user: users,
        profile: profiles,
      })
      .from(wishUserSuggestions)
      .leftJoin(users, eq(wishUserSuggestions.userId, users.id))
      .leftJoin(profiles, eq(users.id, profiles.userId))
      .where(eq(wishUserSuggestions.wishId, wishId))
      .orderBy(desc(wishUserSuggestions.relevanceScore));

    // Get skills and interests for each user
    const usersWithData = await Promise.all(
      userSuggestions.map(async (item) => {
        if (!item.user) return null;
        
        const userSkills = await db.select().from(skills).where(eq(skills.userId, item.user.id));
        const userInterests = await db.select().from(interests).where(eq(interests.userId, item.user.id));
        
        return {
          ...item.user,
          profile: item.profile,
          skills: userSkills,
          interests: userInterests,
          relevanceScore: item.suggestion.relevanceScore,
          reason: item.suggestion.reason,
        };
      })
    );

    // Get group suggestions with group details
    const groupSuggestions = await db
      .select({
        suggestion: wishGroupSuggestions,
        group: groups,
      })
      .from(wishGroupSuggestions)
      .leftJoin(groups, eq(wishGroupSuggestions.groupId, groups.id))
      .where(eq(wishGroupSuggestions.wishId, wishId))
      .orderBy(desc(wishGroupSuggestions.relevanceScore));

    const groupsWithData = groupSuggestions.map(item => ({
      ...item.group,
      relevanceScore: item.suggestion.relevanceScore,
      reason: item.suggestion.reason,
    })).filter(group => group.id);

    return {
      users: usersWithData.filter(user => user !== null),
      groups: groupsWithData
    };
  }

  async createWishUserSuggestion(wishId: string, userId: string, relevanceScore: number, reason: string): Promise<WishUserSuggestion> {
    const [suggestion] = await db
      .insert(wishUserSuggestions)
      .values({
        wishId,
        userId,
        relevanceScore,
        reason,
      })
      .returning();
    return suggestion;
  }

  async createWishGroupSuggestion(wishId: string, groupId: string, relevanceScore: number, reason: string): Promise<WishGroupSuggestion> {
    const [suggestion] = await db
      .insert(wishGroupSuggestions)
      .values({
        wishId,
        groupId,
        relevanceScore,
        reason,
      })
      .returning();
    return suggestion;
  }

  // Match operations
  async createMatch(userId1: string, userId2: string, score: number, reason: string): Promise<Match> {
    const [match] = await db
      .insert(matches)
      .values({
        userId1,
        userId2,
        compatibilityScore: score,
        matchReason: reason,
      })
      .returning();
    return match;
  }

  async getUserMatches(userId: string): Promise<MatchWithUsers[]> {
    const userMatches = await db
      .select()
      .from(matches)
      .where(or(eq(matches.userId1, userId), eq(matches.userId2, userId)))
      .orderBy(desc(matches.createdAt));

    if (userMatches.length === 0) return [];

    // Get all unique user IDs from matches
    const userIds = Array.from(new Set([
      ...userMatches.map(m => m.userId1),
      ...userMatches.map(m => m.userId2)
    ]));

    // Batch fetch all users with profiles
    const usersData = await db
      .select()
      .from(users)
      .leftJoin(profiles, eq(users.id, profiles.userId))
      .where(inArray(users.id, userIds));

    // Batch fetch related data
    const [allSkills, allInterests, allWishlistItems] = await Promise.all([
      db.select().from(skills).where(inArray(skills.userId, userIds)),
      db.select().from(interests).where(inArray(interests.userId, userIds)),
      db.select().from(wishes).where(inArray(wishes.userId, userIds))
    ]);

    // Group data by user ID
    const userProfiles = usersData.reduce((acc, row) => {
      if (row.users) {
        acc[row.users.id] = {
          ...row.users,
          profile: row.profiles || undefined,
          skills: [],
          interests: [],
          wishlistItems: []
        };
      }
      return acc;
    }, {} as Record<string, UserWithProfile>);

    // Add skills, interests, and wishlist items
    allSkills.forEach(skill => {
      const userProfile = userProfiles[skill.userId];
      if (userProfile) {
        userProfile.skills.push(skill);
      }
    });

    allInterests.forEach(interest => {
      const userProfile = userProfiles[interest.userId];
      if (userProfile) {
        userProfile.interests.push(interest);
      }
    });

    allWishlistItems.forEach(item => {
      const userProfile = userProfiles[item.userId];
      if (userProfile) {
        userProfile.wishlistItems.push(item);
      }
    });

    // Build matches with users
    const matchesWithUsers: MatchWithUsers[] = [];
    for (const match of userMatches) {
      const user1 = userProfiles[match.userId1];
      const user2 = userProfiles[match.userId2];

      if (user1 && user2) {
        matchesWithUsers.push({
          ...match,
          user1,
          user2,
        });
      }
    }

    return matchesWithUsers;
  }

  async updateMatchStatus(matchId: string, status: string): Promise<Match | undefined> {
    const [updatedMatch] = await db
      .update(matches)
      .set({ status })
      .where(eq(matches.id, matchId))
      .returning();
    return updatedMatch;
  }

  async getExistingMatch(userId1: string, userId2: string): Promise<Match | undefined> {
    const [match] = await db
      .select()
      .from(matches)
      .where(
        or(
          and(eq(matches.userId1, userId1), eq(matches.userId2, userId2)),
          and(eq(matches.userId1, userId2), eq(matches.userId2, userId1))
        )
      );
    return match;
  }

  async deleteMatch(matchId: string, userId: string): Promise<void> {
    // Verify user is part of this match before deleting
    await db
      .delete(matches)
      .where(
        and(
          eq(matches.id, matchId),
          or(eq(matches.userId1, userId), eq(matches.userId2, userId))
        )
      );
  }

  // Group operations
  async createGroup(group: InsertGroup): Promise<Group> {
    const [newGroup] = await db.insert(groups).values(group).returning();
    
    // Add creator as owner
    await db.insert(groupMemberships).values({
      groupId: newGroup.id,
      userId: group.createdBy,
      role: "owner",
    });

    // Update member count
    await db
      .update(groups)
      .set({ memberCount: 1 })
      .where(eq(groups.id, newGroup.id));

    return newGroup;
  }

  async getGroups(): Promise<GroupWithMembers[]> {
    const allGroups = await db.select().from(groups).orderBy(desc(groups.createdAt));
    
    const groupsWithMembers: GroupWithMembers[] = [];
    
    for (const group of allGroups) {
      const memberships = await db
        .select()
        .from(groupMemberships)
        .leftJoin(users, eq(groupMemberships.userId, users.id))
        .where(eq(groupMemberships.groupId, group.id));

      groupsWithMembers.push({
        ...group,
        memberships: memberships.map(m => ({
          ...m.group_memberships,
          user: m.users!,
        })),
        memberCount: memberships.length,
      });
    }

    return groupsWithMembers;
  }

  async getGroup(id: string): Promise<GroupWithMembers | undefined> {
    const [group] = await db.select().from(groups).where(eq(groups.id, id));
    
    if (!group) return undefined;

    const memberships = await db
      .select()
      .from(groupMemberships)
      .leftJoin(users, eq(groupMemberships.userId, users.id))
      .where(eq(groupMemberships.groupId, id));

    return {
      ...group,
      memberships: memberships.map(m => ({
        ...m.group_memberships,
        user: m.users!,
      })),
      memberCount: memberships.length,
    };
  }

  async joinGroup(groupId: string, userId: string): Promise<GroupMembership> {
    const [membership] = await db
      .insert(groupMemberships)
      .values({ groupId, userId })
      .returning();

    // Update member count
    await db
      .update(groups)
      .set({ memberCount: sql`${groups.memberCount} + 1` })
      .where(eq(groups.id, groupId));

    return membership;
  }

  async leaveGroup(groupId: string, userId: string): Promise<void> {
    await db
      .delete(groupMemberships)
      .where(and(eq(groupMemberships.groupId, groupId), eq(groupMemberships.userId, userId)));

    // Update member count
    await db
      .update(groups)
      .set({ memberCount: sql`${groups.memberCount} - 1` })
      .where(eq(groups.id, groupId));
  }

  async getUserGroups(userId: string): Promise<GroupWithMembers[]> {
    const userMemberships = await db
      .select()
      .from(groupMemberships)
      .where(eq(groupMemberships.userId, userId));

    const userGroups: GroupWithMembers[] = [];

    for (const membership of userMemberships) {
      const group = await this.getGroup(membership.groupId);
      if (group) {
        userGroups.push(group);
      }
    }

    return userGroups;
  }

  // Group suggestions (using unified suggestions table)
  async createGroupSuggestion(userId: string, groupId: string, reason: string, score: number): Promise<Suggestion> {
    const [suggestion] = await db
      .insert(suggestions)
      .values({ userId, targetType: "group", targetId: groupId, reason, score })
      .returning();
    return suggestion;
  }

  async getUserGroupSuggestions(userId: string): Promise<(Suggestion & { group: GroupWithMembers })[]> {
    const groupSuggestions = await db
      .select()
      .from(suggestions)
      .where(and(eq(suggestions.userId, userId), eq(suggestions.targetType, "group"), eq(suggestions.status, "pending")))
      .orderBy(desc(suggestions.score));

    if (groupSuggestions.length === 0) return [];

    // Get all group IDs from suggestions
    const groupIds = groupSuggestions.map(s => s.targetId);

    // Batch fetch groups and their memberships
    const [groupsData, membershipData] = await Promise.all([
      db.select().from(groups).where(inArray(groups.id, groupIds)),
      db
        .select()
        .from(groupMemberships)
        .leftJoin(users, eq(groupMemberships.userId, users.id))
        .where(inArray(groupMemberships.groupId, groupIds))
    ]);

    // Group memberships by group ID
    const membershipsByGroup = membershipData.reduce((acc, row) => {
      if (row.group_memberships && row.users) {
        const groupId = row.group_memberships.groupId;
        acc[groupId] = acc[groupId] || [];
        acc[groupId].push({
          ...row.group_memberships,
          user: row.users,
        });
      }
      return acc;
    }, {} as Record<string, any[]>);

    // Create groups with members
    const groupsWithMembers = groupsData.reduce((acc, group) => {
      const memberships = membershipsByGroup[group.id] || [];
      acc[group.id] = {
        ...group,
        memberships,
        memberCount: memberships.length,
      };
      return acc;
    }, {} as Record<string, GroupWithMembers>);

    // Build suggestions with groups
    const suggestionsWithGroups: (Suggestion & { group: GroupWithMembers })[] = [];
    for (const suggestion of groupSuggestions) {
      const group = groupsWithMembers[suggestion.targetId];
      if (group) {
        suggestionsWithGroups.push({
          ...suggestion,
          group,
        });
      }
    }

    return suggestionsWithGroups;
  }

  async updateGroupSuggestionStatus(suggestionId: string, status: string): Promise<Suggestion | undefined> {
    const [updatedSuggestion] = await db
      .update(suggestions)
      .set({ status })
      .where(eq(suggestions.id, suggestionId))
      .returning();
    return updatedSuggestion;
  }

  async deleteGroupSuggestion(suggestionId: string, userId: string): Promise<void> {
    // Verify the suggestion belongs to the user before deleting
    await db
      .delete(suggestions)
      .where(and(eq(suggestions.id, suggestionId), eq(suggestions.userId, userId)));
  }

  // Analytics
  async getUserStats(userId: string): Promise<{
    totalMatches: number;
    newMatches: number;
    suggestedGroups: number;
  }> {
    const totalMatches = await db
      .select({ count: sql<number>`count(*)` })
      .from(matches)
      .where(or(eq(matches.userId1, userId), eq(matches.userId2, userId)));

    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    const newMatches = await db
      .select({ count: sql<number>`count(*)` })
      .from(matches)
      .where(
        and(
          or(eq(matches.userId1, userId), eq(matches.userId2, userId)),
          sql`${matches.createdAt} >= ${oneWeekAgo}`
        )
      );

    const suggestedGroups = await db
      .select({ count: sql<number>`count(*)` })
      .from(suggestions)
      .where(and(eq(suggestions.userId, userId), eq(suggestions.targetType, "group"), eq(suggestions.status, "pending")));

    return {
      totalMatches: totalMatches[0]?.count || 0,
      newMatches: newMatches[0]?.count || 0,
      suggestedGroups: suggestedGroups[0]?.count || 0,
    };
  }

  // Utility functions for matching algorithm
  async getAllUsersForMatching(excludeUserId: string): Promise<UserWithProfile[]> {
    // Get all users with profiles in a single query
    const allUsers = await db
      .select()
      .from(users)
      .leftJoin(profiles, eq(users.id, profiles.userId))
      .where(and(sql`${users.id} != ${excludeUserId}`, eq(profiles.isActive, true)));

    if (allUsers.length === 0) return [];

    // Get all user IDs for batch queries
    const userIds = allUsers.map(row => row.users!.id);

    // Batch fetch all related data
    const [allSkills, allInterests, allWishlistItems] = await Promise.all([
      db.select().from(skills).where(inArray(skills.userId, userIds)),
      db.select().from(interests).where(inArray(interests.userId, userIds)),
      db.select().from(wishes).where(inArray(wishes.userId, userIds))
    ]);

    // Group data by user ID
    const skillsByUser = allSkills.reduce((acc, skill) => {
      acc[skill.userId] = acc[skill.userId] || [];
      acc[skill.userId].push(skill);
      return acc;
    }, {} as Record<string, Skill[]>);

    const interestsByUser = allInterests.reduce((acc, interest) => {
      acc[interest.userId] = acc[interest.userId] || [];
      acc[interest.userId].push(interest);
      return acc;
    }, {} as Record<string, Interest[]>);

    const wishlistByUser = allWishlistItems.reduce((acc, item) => {
      acc[item.userId] = acc[item.userId] || [];
      acc[item.userId].push(item);
      return acc;
    }, {} as Record<string, Wish[]>);

    // Combine data
    const usersWithProfiles: UserWithProfile[] = [];
    for (const userRow of allUsers) {
      if (userRow.users && userRow.profiles) {
        const userId = userRow.users.id;
        usersWithProfiles.push({
          ...userRow.users,
          profile: userRow.profiles,
          skills: skillsByUser[userId] || [],
          interests: interestsByUser[userId] || [],
          wishlistItems: wishlistByUser[userId] || [],
        });
      }
    }

    return usersWithProfiles;
  }

  async updateProfileCompletion(userId: string): Promise<void> {
    const user = await this.getUserWithProfile(userId);
    if (!user) return;

    let completionScore = 0;
    const maxScore = 100;

    // Basic info (20 points)
    if (user.firstName && user.lastName) completionScore += 10;
    if (user.profile?.bio) completionScore += 10;

    // Location (20 points)
    if (user.profile?.location) completionScore += 20;

    // Skills (20 points)
    if (user.skills && user.skills.length > 0) {
      completionScore += Math.min(20, user.skills.length * 5);
    }

    // Interests (20 points)
    if (user.interests && user.interests.length > 0) {
      completionScore += Math.min(20, user.interests.length * 5);
    }

    // Wishlist items (20 points)
    if (user.wishlistItems && user.wishlistItems.length > 0) {
      completionScore += Math.min(20, user.wishlistItems.length * 4);
    }

    const completionPercentage = Math.min(maxScore, completionScore);

    await db
      .update(profiles)
      .set({ completionPercentage })
      .where(eq(profiles.userId, userId));
  }

  // Get all unique skills for searchable dropdown
  async getAllUniqueSkills(): Promise<{ name: string, count: number }[]> {
    const result = await db
      .select({
        name: skills.name,
        count: sql<number>`count(*)`,
      })
      .from(skills)
      .groupBy(skills.name)
      .orderBy(sql`count(*) desc`);

    return result;
  }

  // Get all unique interests for searchable dropdown
  async getAllUniqueInterests(): Promise<{ name: string, count: number }[]> {
    const result = await db
      .select({
        name: interests.name,
        count: sql<number>`count(*)`,
      })
      .from(interests)
      .groupBy(interests.name)
      .orderBy(sql`count(*) desc`);

    return result;
  }
}

export const storage = new DatabaseStorage();
