import OpenAI from "openai";
import { writeFileSync, readFileSync, unlinkSync, createReadStream } from "fs";
import { db } from "./db";
import { 
  users, 
  profiles, 
  skills, 
  interests, 
  groups,
  groupMemberships
} from "@shared/schema";
import { eq, ne, and } from "drizzle-orm";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY_ENV_VAR || "default_key" 
});

export interface MatchSearchResults {
  userMatches: Array<{
    userId: string;
    relevanceScore: number;
    reason: string;
  }>;
  groupMatches: Array<{
    groupId: string;
    relevanceScore: number;
    reason: string;
  }>;
}

// Export database files for match search - RAW DATABASE TABLES
async function exportUsersForMatchSearch(): Promise<string> {
  // Export raw tables without processing
  const [allUsers, allProfiles, allSkills, allInterests] = await Promise.all([
    db.select().from(users),
    db.select().from(profiles),
    db.select().from(skills),
    db.select().from(interests)
  ]);

  const databaseExport = {
    users: allUsers,
    profiles: allProfiles,
    skills: allSkills,
    interests: allInterests
  };

  const filePath = "./temp_users_for_matching.json";
  writeFileSync(filePath, JSON.stringify(databaseExport, null, 2));
  console.log(`✅ Exported raw database tables to ${filePath}`);
  return filePath;
}

async function exportGroupsForMatchSearch(): Promise<string> {
  // Export raw groups and memberships tables
  const [allGroups, allMemberships] = await Promise.all([
    db.select().from(groups),
    db.select().from(groupMemberships)
  ]);

  const databaseExport = {
    groups: allGroups,
    groupMemberships: allMemberships
  };

  const filePath = "./temp_groups_for_matching.json";
  writeFileSync(filePath, JSON.stringify(databaseExport, null, 2));
  console.log(`✅ Exported raw group database tables to ${filePath}`);
  return filePath;
}

// NEW: Database-based match search using file attachments
export async function findMatchesFromDatabase(
  searchingUserId: string,
  searchCriteria: {
    radius?: number;
    selectedSkills?: string[];
    selectedInterests?: string[];
    searchQuery?: string;
  }
): Promise<MatchSearchResults> {
  console.log(`🔍 Finding matches from database for user ${searchingUserId}`);
  
  try {
    // Get the searching user's profile
    const searchingUser = await db
      .select()
      .from(users)
      .leftJoin(profiles, eq(users.id, profiles.userId))
      .leftJoin(skills, eq(users.id, skills.userId))
      .leftJoin(interests, eq(users.id, interests.userId))
      .where(eq(users.id, searchingUserId));

    if (searchingUser.length === 0) {
      throw new Error("Searching user not found");
    }

    // Export database files
    const [usersFile, groupsFile] = await Promise.all([
      exportUsersForMatchSearch(),
      exportGroupsForMatchSearch()
    ]);

    // Create the match search prompt
    const userProfile = searchingUser[0];
    const userSkills = searchingUser.filter(r => r.skills).map(r => r.skills);
    const userInterests = searchingUser.filter(r => r.interests).map(r => r.interests);

    const prompt = `Find relevant matches from the attached RAW DATABASE FILES for a user's search criteria.

SEARCHING USER PROFILE:
Name: ${userProfile.users.firstName} ${userProfile.users.lastName}
Location: ${userProfile.profiles?.location || "Not specified"}
Bio: ${userProfile.profiles?.bio || "No bio"}
Skills: ${userSkills.map(s => `${s.name} (${s.level})`).join(", ") || "None"}
Interests: ${userInterests.map(i => `${i.name} (${i.level})`).join(", ") || "None"}

SEARCH CRITERIA:
${searchCriteria.selectedSkills?.length ? `Skills Filter: ${searchCriteria.selectedSkills.join(", ")}` : "No specific skills requested"}
${searchCriteria.selectedInterests?.length ? `Interests Filter: ${searchCriteria.selectedInterests.join(", ")}` : "No specific interests requested"}
${searchCriteria.searchQuery ? `Search Query: "${searchCriteria.searchQuery}"` : "No search query provided"}
${searchCriteria.radius ? `Location Radius: ${searchCriteria.radius}km` : "No location filter"}

TASK:
1. Read the RAW DATABASE TABLES from the attached files
2. Join users with profiles, skills, and interests tables to understand complete user data
3. Join groups with memberships to understand group participation
4. Find users and groups that match the search criteria AND would benefit the searching user
5. Focus on meaningful connections, skill exchanges, and mutual benefit opportunities
6. Score relevance 1-100 (minimum 60 to include)
7. Maximum 20 total matches (both users and groups combined)
8. EXCLUDE the searching user (ID: ${searchingUserId}) from results

ATTACHED DATABASE FILES CONTAIN:
- temp_users_for_matching.json: Raw database tables (users, profiles, skills, interests)
- temp_groups_for_matching.json: Raw database tables (groups, groupMemberships)

You need to JOIN these tables yourself to create complete user and group profiles for analysis.

Return JSON format:
{
  "userMatches": [
    {
      "userId": "user_id",
      "relevanceScore": 85,
      "reason": "Specific reason why this user matches search criteria and could benefit the searcher"
    }
  ],
  "groupMatches": [
    {
      "groupId": "group_id",
      "relevanceScore": 90,
      "reason": "Specific reason why this group matches search criteria and would benefit the searcher"
    }
  ]
}`;

    // Upload files to OpenAI Files API
    console.log("📤 Uploading database files to OpenAI for match search...");
    
    const [usersFileUpload, groupsFileUpload] = await Promise.all([
      openai.files.create({
        file: createReadStream(usersFile),
        purpose: "assistants"
      }),
      openai.files.create({
        file: createReadStream(groupsFile),
        purpose: "assistants"
      })
    ]);

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ 
        role: "user", 
        content: `${prompt}

ATTACHED FILES:
- users_database.json (file_id: ${usersFileUpload.id})
- groups_database.json (file_id: ${groupsFileUpload.id})

Please analyze these uploaded files to find relevant matches.`
      }],
      response_format: { type: "json_object" },
      temperature: 0.7,
    });

    // Clean up files from OpenAI
    await Promise.all([
      openai.files.delete(usersFileUpload.id),
      openai.files.delete(groupsFileUpload.id)
    ]);

    const results = JSON.parse(response.choices[0].message.content || "{}");
    
    // Clean up local files
    unlinkSync(usersFile);
    unlinkSync(groupsFile);
    
    console.log(`✅ Found ${results.userMatches?.length || 0} user matches and ${results.groupMatches?.length || 0} group matches`);
    
    return {
      userMatches: results.userMatches || [],
      groupMatches: results.groupMatches || []
    };
    
  } catch (error) {
    console.error("Error finding matches from database:", error);
    throw new Error("Failed to find matches from database");
  }
}

// LEGACY: Keep for backward compatibility (but not used in new match search)
interface MatchAnalysis {
  compatibilityScore: number;
  matchReason: string;
  sharedInterests: string[];
  complementarySkills: string[];
  potentialSynergies: string[];
}

export async function analyzeUserCompatibility(
  user1: any,
  user2: any
): Promise<MatchAnalysis> {
  // This function is now legacy - the new approach uses findMatchesFromDatabase
  return {
    compatibilityScore: 0,
    matchReason: "Please use the new database-based match search",
    sharedInterests: [],
    complementarySkills: [],
    potentialSynergies: [],
  };
}