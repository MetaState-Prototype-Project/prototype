import OpenAI from "openai";
import { writeFileSync, readFileSync, unlinkSync, createReadStream } from "fs";
import { db } from "./db";
import { 
  users, 
  profiles, 
  groups, 
  wishes,
  skills,
  interests,
  wishUserSuggestions,
  wishGroupSuggestions
} from "@shared/schema";
import { eq } from "drizzle-orm";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Export user database to file for AI analysis - RAW TABLES
async function exportUsersDatabase(): Promise<string> {
  console.log("📁 Exporting users database...");
  
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

  const filePath = './users_database.json';
  writeFileSync(filePath, JSON.stringify(databaseExport, null, 2));
  console.log(`✅ Exported raw database tables to ${filePath}`);
  return filePath;
}

// Export groups database to file for AI analysis - RAW TABLES
async function exportGroupsDatabase(): Promise<string> {
  console.log("📁 Exporting groups database...");
  
  // Export raw tables without processing
  const [allGroups, allMemberships] = await Promise.all([
    db.select().from(groups),
    db.select().from(groupMemberships)
  ]);

  const databaseExport = {
    groups: allGroups,
    groupMemberships: allMemberships
  };
  
  const filePath = './groups_database.json';
  writeFileSync(filePath, JSON.stringify(databaseExport, null, 2));
  console.log(`✅ Exported raw group database tables to ${filePath}`);
  return filePath;
}

// Export wishes to file for AI analysis
async function exportWishesForUser(userId: string): Promise<string> {
  console.log(`📁 Exporting wishes for user ${userId}...`);
  
  const userWishes = await db
    .select()
    .from(wishes)
    .where(eq(wishes.userId, userId));
  
  const filePath = './user_wishes.json';
  writeFileSync(filePath, JSON.stringify(userWishes, null, 2));
  console.log(`✅ Exported ${userWishes.length} wishes to ${filePath}`);
  return filePath;
}

// NEW WISH ANALYSIS: Called when user creates a new wish
export async function analyzeNewWish(wishId: string, userId: string) {
  console.log(`🔍 Analyzing new wish: ${wishId}`);
  
  try {
    // Export database files
    const [usersFile, groupsFile, wishesFile] = await Promise.all([
      exportUsersDatabase(),
      exportGroupsDatabase(), 
      exportWishesForUser(userId)
    ]);

    // Read the actual wish data
    const wishesData = JSON.parse(readFileSync(wishesFile, 'utf8'));
    const targetWish = wishesData.find((w: any) => w.id === wishId);
    
    if (!targetWish) {
      throw new Error("Target wish not found");
    }

    // Create prompt for single wish analysis
    const prompt = `Analyze the attached RAW DATABASE FILES to find relevant suggestions for ONE specific wish.

TARGET WISH:
ID: ${targetWish.id}
Title: ${targetWish.title}
Description: ${targetWish.description || 'No description provided'}

TASK:
1. Read RAW DATABASE TABLES from users_database.json and groups_database.json 
2. Join users with profiles, skills, and interests tables to understand complete user data
3. Join groups with memberships to understand group participation
4. Find users and groups that could help with the target wish
5. Score relevance 1-100 (minimum 50 to include)
6. Maximum 20 total suggestions
7. Provide specific reasons

ATTACHED DATABASE FILES CONTAIN:
- users_database.json: Raw database tables (users, profiles, skills, interests)
- groups_database.json: Raw database tables (groups, groupMemberships)
- user_wishes.json: Context about the user's other wishes

You need to JOIN these tables yourself to create complete user and group profiles for analysis.

Return JSON format:
{
  "wishId": "${wishId}",
  "userSuggestions": [
    {
      "userId": "user_id",
      "relevanceScore": 85,
      "reason": "Specific reason why this user can help"
    }
  ],
  "groupSuggestions": [
    {
      "groupId": "group_id", 
      "relevanceScore": 90,
      "reason": "Specific reason why this group is relevant"
    }
  ]
}`;

    // Upload files to OpenAI and get suggestions
    console.log("🤖 Uploading files to OpenAI for analysis...");
    
    // REAL FILE ATTACHMENT: Upload files to OpenAI Files API
    console.log("📤 Uploading database files to OpenAI...");
    
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

Please analyze these uploaded files to find relevant suggestions.`
      }],
      response_format: { type: "json_object" },
      temperature: 0.3,
    });

    // Clean up uploaded files
    await Promise.all([
      openai.files.delete(usersFileUpload.id),
      openai.files.delete(groupsFileUpload.id)
    ]);

    const analysis = JSON.parse(response.choices[0].message.content || "{}");
    
    // Store suggestions in database
    await storeSuggestionsInDatabase(analysis);
    
    // Clean up files
    unlinkSync(usersFile);
    unlinkSync(groupsFile);
    unlinkSync(wishesFile);
    
    console.log(`✅ Completed analysis for new wish: ${targetWish.title}`);
    return analysis;
    
  } catch (error) {
    console.error("Error analyzing new wish:", error);
    throw new Error("Failed to analyze new wish");
  }
}

// DAILY BATCH ANALYSIS: Called every 24 hours for all user wishes
export async function analyzeDailyWishesBatch(userId: string) {
  console.log(`🔍 Running daily analysis for user ${userId}`);
  
  try {
    // Export database files
    const [usersFile, groupsFile, wishesFile] = await Promise.all([
      exportUsersDatabase(),
      exportGroupsDatabase(),
      exportWishesForUser(userId)
    ]);

    // Read user's wishes
    const wishesData = JSON.parse(readFileSync(wishesFile, 'utf8'));
    
    if (wishesData.length === 0) {
      console.log("No wishes found for daily analysis");
      return;
    }

    // Create prompt for batch analysis of ALL wishes
    const prompt = `Analyze the attached RAW DATABASE FILES to find relevant suggestions for ALL user wishes.

USER'S WISHES:
${wishesData.map((w: any) => `- ${w.title}: ${w.description || 'No description'}`).join('\n')}

TASK:
1. Read RAW DATABASE TABLES from users_database.json and groups_database.json
2. Join users with profiles, skills, and interests tables to understand complete user data
3. Join groups with memberships to understand group participation
4. For EACH wish, find relevant users and groups
5. Score relevance 1-100 (minimum 50 to include)  
6. Maximum 20 total suggestions across ALL wishes
7. Prioritize highest scoring suggestions

ATTACHED DATABASE FILES CONTAIN:
- users_database.json: Raw database tables (users, profiles, skills, interests)
- groups_database.json: Raw database tables (groups, groupMemberships)
- user_wishes.json: All user's wishes requiring analysis

You need to JOIN these tables yourself to create complete user and group profiles for analysis.

Return JSON with suggestions for each wish:
{
  "batchResults": [
    {
      "wishId": "wish_id",
      "userSuggestions": [...],
      "groupSuggestions": [...]
    }
  ]
}`;

    // REAL FILE ATTACHMENT: Upload files to OpenAI Files API
    console.log("📤 Uploading database files for batch analysis...");
    
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

Please analyze these uploaded files to find suggestions for all wishes.`
      }],
      response_format: { type: "json_object" },
      temperature: 0.3,
    });

    // Clean up uploaded files
    await Promise.all([
      openai.files.delete(usersFileUpload.id),
      openai.files.delete(groupsFileUpload.id)
    ]);

    const batchAnalysis = JSON.parse(response.choices[0].message.content || "{}");
    
    // Store all batch results
    for (const result of batchAnalysis.batchResults || []) {
      await storeSuggestionsInDatabase(result);
    }
    
    // Clean up files
    unlinkSync(usersFile);
    unlinkSync(groupsFile);
    unlinkSync(wishesFile);
    
    console.log(`✅ Completed daily batch analysis for ${wishesData.length} wishes`);
    return batchAnalysis;
    
  } catch (error) {
    console.error("Error in daily batch analysis:", error);
    throw new Error("Failed to run daily batch analysis");
  }
}

// Store suggestions in database
async function storeSuggestionsInDatabase(analysis: any) {
  const wishId = analysis.wishId;
  
  // Store user suggestions with validation
  for (const userSuggestion of analysis.userSuggestions || []) {
    if (userSuggestion.userId && userSuggestion.relevanceScore) {
      await db.insert(wishUserSuggestions).values({
        wishId: wishId,
        userId: userSuggestion.userId,
        relevanceScore: parseInt(userSuggestion.relevanceScore) || 50,
        reason: userSuggestion.reason || "AI-generated suggestion",
      });
    }
  }
  
  // Store group suggestions with validation
  for (const groupSuggestion of analysis.groupSuggestions || []) {
    if (groupSuggestion.groupId && groupSuggestion.relevanceScore) {
      await db.insert(wishGroupSuggestions).values({
        wishId: wishId,
        groupId: groupSuggestion.groupId,
        relevanceScore: parseInt(groupSuggestion.relevanceScore) || 50,
        reason: groupSuggestion.reason || "AI-generated suggestion",
      });
    }
  }
  
  console.log(`💾 Stored ${analysis.userSuggestions?.length || 0} user and ${analysis.groupSuggestions?.length || 0} group suggestions for wish ${wishId}`);
}