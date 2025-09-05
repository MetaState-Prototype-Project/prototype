import { db } from "./db";
import { users, profiles, skills, interests, groups, matches, suggestions, wishes } from "@shared/schema";
import { sql } from "drizzle-orm";

// Clear existing matches and suggestions as requested
export async function clearMatchesAndSuggestions() {
  console.log("Clearing existing matches and suggestions...");
  try {
    await db.delete(matches);
    console.log("Cleared matches");
  } catch (error) {
    console.log("No matches table to clear");
  }
  
  try {
    await db.delete(suggestions);
    console.log("Cleared suggestions");
  } catch (error) {
    console.log("No suggestions table to clear");
  }
}

// Extensive test data for 100 users
export async function seedExtensiveUsers() {
  console.log("Seeding 100 test users...");
  
  const locations = [
    "San Francisco, CA", "New York, NY", "Los Angeles, CA", "Chicago, IL", "Austin, TX",
    "Seattle, WA", "Boston, MA", "Denver, CO", "Portland, OR", "Miami, FL",
    "Atlanta, GA", "Phoenix, AZ", "Philadelphia, PA", "San Diego, CA", "Dallas, TX",
    "Nashville, TN", "Raleigh, NC", "Salt Lake City, UT", "Minneapolis, MN", "Detroit, MI"
  ];
  
  const jobTitles = [
    "Software Engineer", "Product Manager", "Designer", "Data Scientist", "Marketing Manager",
    "Sales Representative", "Business Analyst", "Project Manager", "DevOps Engineer", "Frontend Developer",
    "Backend Developer", "Full Stack Developer", "UX Researcher", "Content Writer", "Social Media Manager",
    "Financial Analyst", "HR Manager", "Operations Manager", "Customer Success Manager", "QA Engineer"
  ];
  
  const companies = [
    "Google", "Apple", "Microsoft", "Amazon", "Meta", "Netflix", "Spotify", "Airbnb", "Uber", "Lyft",
    "Stripe", "Square", "Dropbox", "Slack", "Zoom", "Salesforce", "Adobe", "Figma", "Notion", "Canva",
    "Startup Co", "Tech Solutions Inc", "Innovation Labs", "Digital Agency", "Creative Studio"
  ];
  
  const firstNames = [
    "Alex", "Jordan", "Taylor", "Casey", "Morgan", "Avery", "Riley", "Cameron", "Sage", "Quinn",
    "Emma", "Liam", "Olivia", "Noah", "Ava", "Ethan", "Sophia", "Mason", "Isabella", "William",
    "Mia", "James", "Charlotte", "Benjamin", "Amelia", "Lucas", "Harper", "Henry", "Evelyn", "Alexander",
    "Abigail", "Michael", "Emily", "Daniel", "Elizabeth", "Matthew", "Mila", "Jackson", "Ella", "Sebastian",
    "Grace", "David", "Victoria", "Carter", "Aria", "Wyatt", "Scarlett", "Jayden", "Chloe", "John",
    "Zoey", "Owen", "Penelope", "Dylan", "Layla", "Luke", "Riley", "Gabriel", "Nora", "Anthony",
    "Lily", "Isaac", "Eleanor", "Grayson", "Hannah", "Jack", "Lillian", "Julian", "Addison", "Levi",
    "Aubrey", "Christopher", "Ellie", "Joshua", "Stella", "Andrew", "Natalie", "Theodore", "Zoe", "Caleb",
    "Leah", "Ryan", "Hazel", "Asher", "Violet", "Nathan", "Aurora", "Thomas", "Savannah", "Leo",
    "Audrey", "Isaiah", "Brooklyn", "Charles", "Bella", "Josiah", "Claire", "Angel", "Skylar", "Adrian"
  ];
  
  const lastNames = [
    "Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis", "Rodriguez", "Martinez",
    "Hernandez", "Lopez", "Gonzalez", "Wilson", "Anderson", "Thomas", "Taylor", "Moore", "Jackson", "Martin",
    "Lee", "Perez", "Thompson", "White", "Harris", "Sanchez", "Clark", "Ramirez", "Lewis", "Robinson",
    "Walker", "Young", "Allen", "King", "Wright", "Scott", "Torres", "Nguyen", "Hill", "Flores",
    "Green", "Adams", "Nelson", "Baker", "Hall", "Rivera", "Campbell", "Mitchell", "Carter", "Roberts"
  ];
  
  const allSkills = [
    "JavaScript", "Python", "React", "Node.js", "TypeScript", "Java", "C++", "Go", "Rust", "Swift",
    "UI/UX Design", "Graphic Design", "Product Design", "Web Design", "Motion Graphics",
    "Project Management", "Agile", "Scrum", "Leadership", "Team Management",
    "Data Analysis", "Machine Learning", "SQL", "Statistics", "Excel",
    "Marketing", "SEO", "Content Marketing", "Social Media", "Email Marketing",
    "Sales", "Business Development", "Negotiation", "Customer Relations", "CRM",
    "Photography", "Video Editing", "Content Creation", "Writing", "Copywriting",
    "Finance", "Accounting", "Investment", "Budgeting", "Financial Planning",
    "DevOps", "Cloud Computing", "AWS", "Docker", "Kubernetes",
    "Mobile Development", "iOS", "Android", "Flutter", "React Native"
  ];
  
  const allInterests = [
    "Hiking", "Photography", "Cooking", "Reading", "Travel", "Music", "Gaming", "Fitness",
    "Yoga", "Meditation", "Art", "Dancing", "Theater", "Movies", "TV Shows", "Podcasts",
    "Technology", "AI", "Startups", "Entrepreneurship", "Investing", "Real Estate",
    "Sports", "Basketball", "Soccer", "Tennis", "Swimming", "Running", "Cycling",
    "Food", "Wine", "Coffee", "Craft Beer", "Restaurants", "Farmers Markets",
    "Nature", "Camping", "Rock Climbing", "Surfing", "Skiing", "Snowboarding",
    "Learning", "Languages", "History", "Science", "Philosophy", "Psychology",
    "Volunteering", "Environment", "Sustainability", "Community", "Networking"
  ];
  
  const interestCategories = ["hobby", "lifestyle", "career", "sport", "culture", "technology"];
  
  for (let i = 1; i <= 100; i++) {
    const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
    const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
    const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}${i}@example.com`;
    const location = locations[Math.floor(Math.random() * locations.length)];
    const jobTitle = jobTitles[Math.floor(Math.random() * jobTitles.length)];
    const company = companies[Math.floor(Math.random() * companies.length)];
    
    // Create user
    const userId = `test_user_${i}`;
    await db.insert(users).values({
      id: userId,
      email,
      firstName,
      lastName,
      profileImageUrl: `https://images.unsplash.com/photo-${1500000000000 + i}?w=400&h=400&fit=crop&crop=face`
    }).onConflictDoNothing();
    
    // Create profile
    await db.insert(profiles).values({
      userId,
      bio: `${jobTitle} at ${company}. Passionate about technology and innovation. Love connecting with like-minded professionals.`,
      location,
      jobTitle,
      company,
      searchRadius: Math.floor(Math.random() * 50) + 10, // 10-60 km
      completionPercentage: Math.floor(Math.random() * 30) + 70 // 70-100%
    }).onConflictDoNothing();
    
    // Add 3-7 random skills
    const userSkills = [];
    const numSkills = Math.floor(Math.random() * 5) + 3;
    for (let j = 0; j < numSkills; j++) {
      const skill = allSkills[Math.floor(Math.random() * allSkills.length)];
      if (!userSkills.includes(skill)) {
        userSkills.push(skill);
        const proficiencies = ["beginner", "intermediate", "advanced", "expert"];
        await db.insert(skills).values({
          userId,
          name: skill,
          proficiency: proficiencies[Math.floor(Math.random() * proficiencies.length)]
        }).onConflictDoNothing();
      }
    }
    
    // Add 4-8 random interests
    const userInterests = [];
    const numInterests = Math.floor(Math.random() * 5) + 4;
    for (let j = 0; j < numInterests; j++) {
      const interest = allInterests[Math.floor(Math.random() * allInterests.length)];
      if (!userInterests.includes(interest)) {
        userInterests.push(interest);
        await db.insert(interests).values({
          userId,
          name: interest,
          category: interestCategories[Math.floor(Math.random() * interestCategories.length)]
        }).onConflictDoNothing();
      }
    }
  }
  
  console.log("Seeded 100 test users with profiles, skills, and interests");
}

// Extensive test data for 100 groups
export async function seedExtensiveGroups() {
  console.log("Seeding 100 test groups...");
  
  const groupTypes = [
    { prefix: "Tech", categories: ["Technology", "Programming", "AI", "Startups"] },
    { prefix: "Fitness", categories: ["Health", "Sports", "Wellness"] },
    { prefix: "Creative", categories: ["Art", "Design", "Photography", "Music"] },
    { prefix: "Professional", categories: ["Business", "Networking", "Career"] },
    { prefix: "Hobby", categories: ["Gaming", "Cooking", "Reading", "Travel"] },
    { prefix: "Learning", categories: ["Education", "Languages", "Skills"] },
    { prefix: "Community", categories: ["Volunteering", "Social", "Environment"] }
  ];
  
  const locations = [
    "San Francisco, CA", "New York, NY", "Los Angeles, CA", "Chicago, IL", "Austin, TX",
    "Seattle, WA", "Boston, MA", "Denver, CO", "Portland, OR", "Miami, FL",
    "Global", "Virtual", "Online"
  ];
  
  const groupNames = [
    "Innovators Hub", "Code Masters", "Design Collective", "Fitness Warriors", "Creative Minds",
    "Startup Network", "Learning Circle", "Photography Club", "Music Makers", "Book Lovers",
    "Travelers United", "Cooking Enthusiasts", "Gaming Community", "Tech Talks", "Art Society",
    "Business Leaders", "Wellness Group", "Language Exchange", "Volunteer Network", "Sports Club",
    "Investment Club", "Writers Guild", "Makers Space", "Dance Community", "Outdoor Adventures",
    "Film Society", "Craft Beer Club", "Wine Tasting", "Running Group", "Cycling Club",
    "Yoga Practice", "Meditation Circle", "Environmental Action", "Career Growth", "Mentorship",
    "Data Science", "Machine Learning", "Frontend Developers", "Backend Engineers", "Mobile Devs",
    "Product Managers", "UX Designers", "Content Creators", "Digital Nomads", "Remote Workers",
    "Entrepreneurs", "Side Hustlers", "Financial Freedom", "Real Estate", "Crypto Enthusiasts"
  ];
  
  for (let i = 1; i <= 100; i++) {
    const groupType = groupTypes[Math.floor(Math.random() * groupTypes.length)];
    const baseName = groupNames[Math.floor(Math.random() * groupNames.length)];
    const name = `${groupType.prefix} ${baseName}`;
    const category = groupType.categories[Math.floor(Math.random() * groupType.categories.length)];
    const location = locations[Math.floor(Math.random() * locations.length)];
    const memberCount = Math.floor(Math.random() * 500) + 10; // 10-510 members
    const maxMembers = memberCount + Math.floor(Math.random() * 200) + 50; // Room for growth
    
    const descriptions = [
      `A community of passionate ${category.toLowerCase()} enthusiasts sharing knowledge and experiences.`,
      `Join us for regular meetups, workshops, and networking opportunities in ${category.toLowerCase()}.`,
      `Connect with like-minded individuals interested in ${category.toLowerCase()} and professional growth.`,
      `Building a supportive network for ${category.toLowerCase()} professionals and hobbyists.`,
      `Collaborative space for learning, sharing, and growing together in ${category.toLowerCase()}.`
    ];
    
    await db.insert(groups).values({
      id: `test_group_${i}`,
      name,
      description: descriptions[Math.floor(Math.random() * descriptions.length)],
      category,
      location,
      memberCount,
      maxMembers,
      isPublic: Math.random() > 0.1, // 90% public groups
      createdBy: `test_user_${Math.floor(Math.random() * 100) + 1}` // Random creator
    }).onConflictDoNothing();
  }
  
  console.log("Seeded 100 test groups");
}

// Add skills and interests to the current user
export async function enhanceCurrentUserProfile(currentUserId: string) {
  console.log(`Enhancing profile for current user: ${currentUserId}`);
  
  // Add diverse skills
  const userSkills = [
    { name: "JavaScript", proficiency: "expert" },
    { name: "React", proficiency: "advanced" },
    { name: "Node.js", proficiency: "advanced" },
    { name: "TypeScript", proficiency: "intermediate" },
    { name: "UI/UX Design", proficiency: "intermediate" },
    { name: "Project Management", proficiency: "advanced" },
    { name: "Photography", proficiency: "intermediate" },
    { name: "Data Analysis", proficiency: "beginner" }
  ];
  
  for (const skill of userSkills) {
    await db.insert(skills).values({
      userId: currentUserId,
      name: skill.name,
      proficiency: skill.proficiency
    }).onConflictDoNothing();
  }
  
  // Add diverse interests
  const userInterests = [
    { name: "Technology", category: "career" },
    { name: "Startups", category: "career" },
    { name: "Photography", category: "hobby" },
    { name: "Hiking", category: "lifestyle" },
    { name: "Cooking", category: "lifestyle" },
    { name: "Travel", category: "lifestyle" },
    { name: "Reading", category: "hobby" },
    { name: "Fitness", category: "lifestyle" },
    { name: "Music", category: "culture" },
    { name: "AI", category: "technology" }
  ];
  
  for (const interest of userInterests) {
    await db.insert(interests).values({
      userId: currentUserId,
      name: interest.name,
      category: interest.category
    }).onConflictDoNothing();
  }
  
  console.log("Enhanced current user profile with skills and interests");
}

export async function seedExtensiveData() {
  try {
    // Comment out clearing matches to preserve user's search results
    // await clearMatchesAndSuggestions();
    
    // Check if we already have test data
    const existingUsers = await db.select().from(users).where(sql`id LIKE 'test_user_%'`).limit(1);
    if (existingUsers.length === 0) {
      console.log("Seeding test data in background...");
      // Run seeding in background to not block server startup
      Promise.all([
        seedExtensiveUsers(),
        seedExtensiveGroups()
      ]).then(() => {
        console.log("Background seeding completed!");
      }).catch(error => {
        console.error("Background seeding error:", error);
      });
    } else {
      console.log("Test data already exists, skipping seeding");
    }
  } catch (error) {
    console.error("Error in seedExtensiveData:", error);
  }
}