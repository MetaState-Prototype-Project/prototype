import { db } from "./db";
import { socialGroups, charters, groupMembers } from "@shared/schema";

export async function seedSampleData(userId: string) {
  try {
    // Check if user already has data
    const existingGroups = await db.select().from(socialGroups).limit(1);
    if (existingGroups.length > 0) {
      return; // Don't seed if data already exists
    }

    // Create sample social groups
    const sampleGroups = await db.insert(socialGroups).values([
      {
        name: "Tech Innovators",
        platform: "discord",
        externalId: "tech-innovators-discord",
        description: "A community for tech enthusiasts and developers",
        memberCount: 150,
        imageUrl: "https://images.unsplash.com/photo-1517077304055-6e89abbf09b0?w=100&h=100&fit=crop&crop=center",
        ownerId: userId,
      },
      {
        name: "Design Masters",
        platform: "instagram", 
        externalId: "design-masters-ig",
        description: "Graphic design professionals and creatives",
        memberCount: 89,
        imageUrl: "https://images.unsplash.com/photo-1558655146-9f40138edfeb?w=100&h=100&fit=crop&crop=center",
        ownerId: userId,
      },
      {
        name: "Startup Hub",
        platform: "facebook",
        externalId: "startup-hub-fb",
        description: "Entrepreneurs and startup founders network",
        memberCount: 234,
        imageUrl: "https://images.unsplash.com/photo-1553877522-43269d4ea984?w=100&h=100&fit=crop&crop=center",
        ownerId: userId,
      },
      {
        name: "Gaming Community",
        platform: "discord",
        externalId: "gaming-community-discord",
        description: "Competitive gaming and esports enthusiasts",
        memberCount: 312,
        imageUrl: "https://images.unsplash.com/photo-1542751371-adc38448a05e?w=100&h=100&fit=crop&crop=center",
        ownerId: userId,
      },
    ]).returning();

    // Create sample charters for each group
    const sampleCharters = await db.insert(charters).values([
      {
        name: "Tech Innovation Charter",
        description: "Guidelines for maintaining a professional tech community",
        guidelines: [
          "Keep discussions technical and on-topic",
          "Be respectful and constructive in all interactions",
          "Share knowledge and help fellow developers",
          "No spam or self-promotion without permission",
          "Use appropriate channels for different types of content"
        ],
        ownerId: userId,
        groupId: sampleGroups[0].id,
        isActive: true,
      },
      {
        name: "Creative Design Standards",
        description: "Community standards for design professionals",
        guidelines: [
          "Share original work and give proper credit",
          "Provide constructive feedback on others' work",
          "Respect intellectual property rights",
          "Keep critiques professional and helpful",
          "Support emerging designers in the community"
        ],
        ownerId: userId,
        groupId: sampleGroups[1].id,
        isActive: true,
      },
      {
        name: "Startup Network Rules",
        description: "Guidelines for entrepreneurs and business discussions",
        guidelines: [
          "Focus on actionable business advice",
          "No direct sales pitches without permission",
          "Share resources and opportunities with the community",
          "Maintain confidentiality when discussing sensitive topics",
          "Support fellow entrepreneurs with mentorship"
        ],
        ownerId: userId,
        groupId: sampleGroups[2].id,
        isActive: true,
      },
    ]).returning();

    // Add user as admin to all groups
    await db.insert(groupMembers).values(
      sampleGroups.map(group => ({
        groupId: group.id,
        userId: userId,
        role: "admin",
      }))
    );

    console.log("Sample data seeded successfully");
  } catch (error) {
    console.error("Error seeding sample data:", error);
  }
}