import { db } from "./db";
import { 
  users, profiles, skills, interests as interestsTable, groups, groupMemberships, 
  wishes, matches, suggestions 
} from "@shared/schema";
import { eq, isNull, and } from "drizzle-orm";

// Comprehensive data for fully populated profiles
const professionalTitles = [
  "Software Engineer", "Data Scientist", "Product Manager", "UX Designer", "Marketing Manager",
  "Sales Representative", "Project Manager", "Business Analyst", "Graphic Designer", "Teacher",
  "Nurse", "Accountant", "Lawyer", "Chef", "Electrician", "Plumber", "Writer", "Photographer",
  "Fitness Trainer", "Social Worker", "Real Estate Agent", "Financial Advisor", "Consultant",
  "Engineer", "Architect", "Doctor", "Pharmacist", "Therapist", "Artist", "Musician"
];

const companies = [
  "Google", "Microsoft", "Apple", "Amazon", "Meta", "Netflix", "Uber", "Airbnb", "Tesla",
  "Goldman Sachs", "JPMorgan", "Bank of America", "Johnson & Johnson", "Pfizer", "Walmart",
  "Target", "Starbucks", "Nike", "Adobe", "Salesforce", "Local Business", "Startup", "Freelance"
];

const locations = [
  "New York, NY", "Los Angeles, CA", "Chicago, IL", "Houston, TX", "Phoenix, AZ",
  "Philadelphia, PA", "San Antonio, TX", "San Diego, CA", "Dallas, TX", "San Jose, CA",
  "Austin, TX", "Seattle, WA", "Denver, CO", "Washington, DC", "Boston, MA", "Portland, OR",
  "Nashville, TN", "Las Vegas, NV", "Atlanta, GA", "Miami, FL", "Minneapolis, MN", "Tampa, FL"
];

const skillsData = [
  // Technical Skills
  "JavaScript", "Python", "React", "Node.js", "SQL", "Machine Learning", "Data Analysis",
  "Cloud Computing", "Cybersecurity", "Mobile Development", "Web Design", "DevOps",
  
  // Creative Skills  
  "Graphic Design", "Photography", "Video Editing", "Creative Writing", "Music Production",
  "Digital Art", "UI/UX Design", "Animation", "Illustration", "Painting",
  
  // Business Skills
  "Project Management", "Sales", "Marketing", "Leadership", "Public Speaking",
  "Financial Analysis", "Strategic Planning", "Customer Service", "Negotiation",
  
  // Personal Skills
  "Cooking", "Fitness Training", "Yoga", "Language Learning", "Teaching", "Mentoring",
  "Event Planning", "Travel Planning", "Gardening", "Home Repair"
];

const interestsData = [
  "Photography", "Hiking", "Cycling", "Running", "Swimming", "Cooking", "Reading",
  "Music", "Movies", "Travel", "Technology", "Art", "Sports", "Fitness", "Gaming",
  "Volunteering", "Dancing", "Writing", "Learning", "Nature", "Food", "Wine",
  "Coffee", "Books", "Podcasts", "Theater", "Museums", "Concerts", "Festivals"
];

const wishesData = [
  "Learn a new programming language",
  "Start my own business",
  "Travel to Japan",
  "Learn to cook professionally",
  "Run a marathon",
  "Learn Spanish fluently",
  "Write a book",
  "Learn photography",
  "Get promoted at work",
  "Learn to play guitar",
  "Start a podcast",
  "Learn yoga and meditation",
  "Take up rock climbing",
  "Learn digital marketing",
  "Master public speaking",
  "Learn data science",
  "Start investing",
  "Learn graphic design",
  "Build a mobile app",
  "Learn French cuisine"
];

const groupNames = [
  // Professional Groups
  "Tech Entrepreneurs Network", "Data Science Professionals", "UX/UI Designers Circle",
  "Digital Marketing Masters", "Project Management Pros", "Startup Founders Forum",
  "Women in Tech", "Freelancers Network", "Remote Workers Community",
  
  // Hobby Groups  
  "Photography Enthusiasts", "Hiking Adventures Club", "Cooking Masters",
  "Book Lovers Society", "Music Producers Collective", "Gaming Community",
  "Travel Addicts", "Art Lovers Circle", "Fitness Fanatics",
  
  // Learning Groups
  "Language Learning Exchange", "Public Speaking Club", "Creative Writing Group",
  "Investment Club", "Coding Bootcamp Alumni", "Career Changers Support",
  
  // Sports Groups
  "Running Club", "Cycling Team", "Yoga Practitioners", "Tennis Club",
  "Basketball League", "Soccer Team", "Swimming Group", "Rock Climbing Club",
  
  // Creative Groups
  "Independent Artists Collective", "Musicians Jam Session", "Theater Group",
  "Film Making Society", "Podcast Creators", "Content Creators Hub"
];

function getRandomItem<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

function getRandomItems<T>(array: T[], count: number): T[] {
  const shuffled = [...array].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}

export async function ensureFullyPopulatedData() {
  console.log("🎯 Ensuring fully populated data for comprehensive testing...");
  
  try {
    // Get all users and check which ones need profile completion
    const allUsers = await db.select().from(users).limit(50); // Focus on first 50 users
    
    console.log(`👥 Processing ${allUsers.length} users for complete profiles...`);
    
    let profilesCompleted = 0;
    let skillsAdded = 0;
    let interestsAdded = 0;
    let wishesAdded = 0;
    
    for (const user of allUsers) {
      // Ensure user has a complete profile
      const existingProfile = await db.select().from(profiles).where(eq(profiles.userId, user.id));
      
      if (existingProfile.length === 0) {
        // Create complete profile
        await db.insert(profiles).values({
          userId: user.id,
          bio: `${getRandomItem(professionalTitles)} passionate about ${getRandomItem(interestsData)} and ${getRandomItem(interestsData)}. Looking to connect with like-minded individuals and grow my network.`,
          location: getRandomItem(locations),
          latitude: (Math.random() * 60 + 20).toString(), // US latitude range
          longitude: (-Math.random() * 60 - 70).toString(), // US longitude range  
          searchRadius: Math.floor(Math.random() * 75) + 25, // 25-100 miles
          jobTitle: getRandomItem(professionalTitles),
          company: getRandomItem(companies),
          isActive: true,
          completionPercentage: Math.floor(Math.random() * 20) + 80, // 80-100%
        });
        profilesCompleted++;
      } else {
        // Update existing profile to be complete
        const profile = existingProfile[0];
        if (!profile.bio || !profile.jobTitle || !profile.company) {
          await db.update(profiles)
            .set({
              bio: profile.bio || `${getRandomItem(professionalTitles)} passionate about ${getRandomItem(interestsData)} and ${getRandomItem(interestsData)}.`,
              jobTitle: profile.jobTitle || getRandomItem(professionalTitles),
              company: profile.company || getRandomItem(companies),
              location: profile.location || getRandomItem(locations),
              completionPercentage: Math.max(profile.completionPercentage || 0, 85),
            })
            .where(eq(profiles.id, profile.id));
          profilesCompleted++;
        }
      }
      
      // Ensure user has 4-8 skills
      const existingSkills = await db.select().from(skills).where(eq(skills.userId, user.id));
      if (existingSkills.length < 4) {
        const skillsToAdd = Math.floor(Math.random() * 5) + 4; // 4-8 skills
        const userSkills = getRandomItems(skillsData, skillsToAdd);
        
        for (const skill of userSkills) {
          try {
            await db.insert(skills).values({
              userId: user.id,
              name: skill,
              proficiency: getRandomItem(["beginner", "intermediate", "advanced", "expert"]),
            });
            skillsAdded++;
          } catch (error) {
            // Ignore duplicates
          }
        }
      }
      
      // Ensure user has 3-6 interests
      const existingInterests = await db.select().from(interestsTable).where(eq(interestsTable.userId, user.id));
      if (existingInterests.length < 3) {
        const interestsToAdd = Math.floor(Math.random() * 4) + 3; // 3-6 interests
        const userInterests = getRandomItems(interestsData, interestsToAdd);
        
        for (const interest of userInterests) {
          try {
            await db.insert(interestsTable).values({
              userId: user.id,
              name: interest,
              frequency: getRandomItem(["daily", "weekly", "monthly", "occasionally"]),
            });
            interestsAdded++;
          } catch (error) {
            // Ignore duplicates
          }
        }
      }
      
      // Ensure user has 2-5 wishes
      const existingWishes = await db.select().from(wishes).where(eq(wishes.userId, user.id));
      if (existingWishes.length < 2) {
        const wishesToAdd = Math.floor(Math.random() * 4) + 2; // 2-5 wishes
        const userWishes = getRandomItems(wishesData, wishesToAdd);
        
        for (const wish of userWishes) {
          try {
            await db.insert(wishes).values({
              userId: user.id,
              title: wish,
              description: `I want to ${wish.toLowerCase()} to achieve my personal and professional goals.`,
              priority: getRandomItem(["urgent", "high", "medium", "low"]),
              status: "active",
            });
            wishesAdded++;
          } catch (error) {
            // Ignore duplicates
          }
        }
      }
    }
    
    // Ensure we have 40+ fully populated groups
    console.log("🏢 Ensuring fully populated groups...");
    
    const existingGroups = await db.select().from(groups).limit(50);
    let groupsCreated = 0;
    
    // Create additional groups if needed
    if (existingGroups.length < 40) {
      const groupsToCreate = 40 - existingGroups.length;
      const creator = allUsers[0]; // Use first user as creator
      
      for (let i = 0; i < groupsToCreate && i < groupNames.length; i++) {
        const groupName = groupNames[i];
        
        try {
          const [newGroup] = await db.insert(groups).values({
            name: groupName,
            description: `A vibrant community for ${groupName.toLowerCase()} enthusiasts. Join us for regular meetups, networking events, skill sharing sessions, and collaborative projects. Whether you're a beginner or expert, everyone is welcome!`,
            category: getRandomItem(["Professional", "Hobby", "Sports", "Technology", "Arts", "Learning"]),
            location: getRandomItem(locations),
            latitude: (Math.random() * 60 + 20).toString(),
            longitude: (-Math.random() * 60 - 70).toString(),
            memberCount: Math.floor(Math.random() * 200) + 20, // 20-220 members
            maxMembers: Math.floor(Math.random() * 300) + 100, // 100-400 max
            isPublic: Math.random() > 0.2, // 80% public
            createdBy: creator.id,
          }).returning();
          
          // Add 5-15 members to each new group
          const membersToAdd = Math.floor(Math.random() * 11) + 5;
          const groupMembers = getRandomItems(allUsers, membersToAdd);
          
          for (const member of groupMembers) {
            try {
              await db.insert(groupMemberships).values({
                groupId: newGroup.id,
                userId: member.id,
                role: member.id === creator.id ? "owner" : 
                      Math.random() > 0.9 ? "admin" : "member",
              });
            } catch (error) {
              // Ignore duplicates
            }
          }
          
          groupsCreated++;
        } catch (error) {
          console.error(`Error creating group ${groupName}:`, error);
        }
      }
    }
    
    // Get final statistics
    const finalStats = {
      users: await db.select().from(users).then(r => r.length),
      usersWithProfiles: await db.select().from(profiles).then(r => r.length),
      groups: await db.select().from(groups).then(r => r.length),
      skills: await db.select().from(skills).then(r => r.length),
      interests: await db.select().from(interestsTable).then(r => r.length),
      wishes: await db.select().from(wishes).then(r => r.length),
      memberships: await db.select().from(groupMemberships).then(r => r.length),
    };
    
    console.log("✅ Fully populated data verification completed!");
    console.log(`📊 Updated Statistics:`);
    console.log(`   👥 Users: ${finalStats.users} (${finalStats.usersWithProfiles} with complete profiles)`);
    console.log(`   🏢 Groups: ${finalStats.groups}`);
    console.log(`   🎯 User Wishes: ${finalStats.wishes}`);
    console.log(`   🔧 Skills: ${finalStats.skills}`);
    console.log(`   ❤️ Interests: ${finalStats.interests}`);
    console.log(`   👫 Group Memberships: ${finalStats.memberships}`);
    console.log(`📈 Changes Made:`);
    console.log(`   ✨ Profiles completed: ${profilesCompleted}`);
    console.log(`   🔧 Skills added: ${skillsAdded}`);
    console.log(`   ❤️ Interests added: ${interestsAdded}`);
    console.log(`   🎯 Wishes added: ${wishesAdded}`);
    console.log(`   🏢 Groups created: ${groupsCreated}`);
    
  } catch (error) {
    console.error("❌ Error ensuring fully populated data:", error);
    throw error;
  }
}