import { db } from "./db";
import { users, profiles, skills, interests as interestsTable, groups, groupMemberships } from "@shared/schema";

// Comprehensive test data across multiple industries
const industries = [
  "Technology", "Healthcare", "Education", "Finance", "Construction", "Manufacturing",
  "Retail", "Hospitality", "Transportation", "Agriculture", "Entertainment", "Legal",
  "Consulting", "Real Estate", "Energy", "Non-profit", "Government", "Arts & Design"
];

const professions = [
  // Technology
  "Software Engineer", "Data Scientist", "UX Designer", "DevOps Engineer", "Product Manager",
  "Cybersecurity Analyst", "AI/ML Engineer", "Frontend Developer", "Backend Developer", "Mobile Developer",
  
  // Healthcare
  "Registered Nurse", "Physical Therapist", "Radiologist", "Pharmacist", "Medical Assistant",
  "Surgeon", "Pediatrician", "Dentist", "Veterinarian", "Mental Health Counselor",
  
  // Trades & Crafts
  "Electrician", "Plumber", "Carpenter", "HVAC Technician", "Welder", "Mechanic",
  "Mason", "Roofer", "Painter", "Landscaper", "Chef", "Baker", "Barber", "Hairstylist",
  
  // Business & Finance
  "Accountant", "Financial Advisor", "Marketing Manager", "Sales Representative", "HR Manager",
  "Business Analyst", "Project Manager", "Operations Manager", "Investment Banker", "Real Estate Agent",
  
  // Education & Arts
  "Teacher", "Professor", "Librarian", "Graphic Designer", "Photographer", "Musician",
  "Writer", "Actor", "Artist", "Interior Designer", "Architect", "Fashion Designer",
  
  // Service Industries
  "Police Officer", "Firefighter", "Social Worker", "Personal Trainer", "Massage Therapist",
  "Travel Agent", "Event Planner", "Customer Service Rep", "Security Guard", "Janitor"
];

const skillCategories = {
  technical: [
    "JavaScript", "Python", "React", "Node.js", "SQL", "Machine Learning", "Data Analysis",
    "Cloud Computing", "Cybersecurity", "Mobile Development", "Web Design", "Database Management",
    "DevOps", "Artificial Intelligence", "Blockchain", "3D Modeling", "CAD Design"
  ],
  creative: [
    "Graphic Design", "Photography", "Video Editing", "Creative Writing", "Music Production",
    "Digital Art", "UI/UX Design", "Animation", "Illustration", "Painting", "Sculpting",
    "Fashion Design", "Interior Design", "Architecture", "Film Making"
  ],
  trades: [
    "Electrical Work", "Plumbing", "Carpentry", "Welding", "HVAC", "Auto Mechanics",
    "Roofing", "Masonry", "Landscaping", "Painting", "Tiling", "Drywall", "Flooring"
  ],
  business: [
    "Project Management", "Sales", "Marketing", "Leadership", "Negotiation", "Public Speaking",
    "Financial Analysis", "Strategic Planning", "Team Management", "Customer Service",
    "Business Development", "Accounting", "Legal Research"
  ],
  personal: [
    "Cooking", "Fitness Training", "Yoga", "Meditation", "Language Learning", "Teaching",
    "Mentoring", "Event Planning", "Travel Planning", "Gardening", "Home Repair",
    "Pet Training", "Child Care", "Elder Care"
  ]
};

const interests = [
  // Hobbies & Recreation
  "Photography", "Hiking", "Cycling", "Running", "Swimming", "Rock Climbing", "Camping",
  "Fishing", "Hunting", "Gardening", "Cooking", "Baking", "Wine Tasting", "Coffee",
  "Board Games", "Video Games", "Reading", "Writing", "Blogging", "Podcasting",
  
  // Arts & Culture
  "Music", "Dancing", "Theater", "Movies", "Art Galleries", "Museums", "Concerts",
  "Festivals", "Opera", "Ballet", "Jazz", "Classical Music", "Rock Music", "Folk Music",
  
  // Sports & Fitness
  "Basketball", "Football", "Soccer", "Tennis", "Golf", "Baseball", "Volleyball",
  "Martial Arts", "Boxing", "Yoga", "Pilates", "CrossFit", "Weightlifting", "Marathon Running",
  
  // Technology & Learning
  "Technology", "Science", "History", "Philosophy", "Psychology", "Astronomy", "Physics",
  "Chemistry", "Biology", "Environmental Science", "Climate Change", "Sustainability",
  
  // Social & Community
  "Volunteering", "Community Service", "Politics", "Social Justice", "Animal Rights",
  "Environmental Conservation", "Mentoring", "Networking", "Public Speaking", "Leadership",
  
  // Travel & Adventure
  "Travel", "Backpacking", "Cultural Exploration", "Food Tourism", "Adventure Sports",
  "Scuba Diving", "Skiing", "Snowboarding", "Surfing", "Sailing", "Motor Sports"
];

const groupCategories = [
  "Professional", "Hobby", "Sports", "Technology", "Arts", "Business", "Health",
  "Education", "Social", "Volunteer", "Travel", "Food", "Music", "Fitness"
];

const cities = [
  "New York, NY", "Los Angeles, CA", "Chicago, IL", "Houston, TX", "Phoenix, AZ",
  "Philadelphia, PA", "San Antonio, TX", "San Diego, CA", "Dallas, TX", "San Jose, CA",
  "Austin, TX", "Jacksonville, FL", "Fort Worth, TX", "Columbus, OH", "San Francisco, CA",
  "Charlotte, NC", "Indianapolis, IN", "Seattle, WA", "Denver, CO", "Washington, DC",
  "Boston, MA", "El Paso, TX", "Detroit, MI", "Nashville, TN", "Portland, OR",
  "Memphis, TN", "Oklahoma City, OK", "Las Vegas, NV", "Louisville, KY", "Baltimore, MD",
  "Milwaukee, WI", "Albuquerque, NM", "Tucson, AZ", "Fresno, CA", "Sacramento, CA",
  "Mesa, AZ", "Kansas City, MO", "Atlanta, GA", "Long Beach, CA", "Colorado Springs, CO",
  "Raleigh, NC", "Miami, FL", "Virginia Beach, VA", "Omaha, NE", "Oakland, CA",
  "Minneapolis, MN", "Tulsa, OK", "Arlington, TX", "Tampa, FL", "New Orleans, LA"
];

const companies = [
  "Google", "Microsoft", "Apple", "Amazon", "Meta", "Tesla", "Netflix", "Uber", "Airbnb",
  "Goldman Sachs", "JPMorgan Chase", "Bank of America", "Wells Fargo", "Citigroup",
  "Johnson & Johnson", "Pfizer", "UnitedHealth", "CVS Health", "Anthem",
  "Walmart", "Target", "Home Depot", "Costco", "Starbucks", "McDonald's",
  "Boeing", "General Electric", "Ford", "General Motors", "Caterpillar",
  "McKinsey & Company", "Deloitte", "PwC", "EY", "KPMG", "Accenture",
  "Local Business", "Startup", "Freelance", "Self-Employed", "Non-profit"
];

function getRandomItem<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

function getRandomItems<T>(array: T[], count: number): T[] {
  const shuffled = [...array].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}

export async function seedComprehensiveData() {
  console.log("🌱 Starting comprehensive data seeding...");
  
  try {
    // Check if we already have enough data
    const existingUsersCount = await db.select().from(users).then(users => users.length);
    const existingGroupsCount = await db.select().from(groups).then(groups => groups.length);
    
    if (existingUsersCount >= 200 && existingGroupsCount >= 200) {
      console.log(`✅ Sufficient data already exists: ${existingUsersCount} users, ${existingGroupsCount} groups`);
      return;
    }
    
    console.log(`📊 Current data: ${existingUsersCount} users, ${existingGroupsCount} groups`);
    console.log("🔄 Adding more comprehensive test data...");
    
    // Generate additional users
    const usersToCreate = Math.max(0, 200 - existingUsersCount);
    const groupsToCreate = Math.max(0, 200 - existingGroupsCount);
    
    if (usersToCreate > 0) {
      console.log(`👥 Creating ${usersToCreate} additional users...`);
      
      for (let i = 0; i < usersToCreate; i++) {
        const firstName = getRandomItem([
          "Alex", "Jordan", "Taylor", "Morgan", "Casey", "Riley", "Avery", "Quinn", "Sage", "River",
          "Emma", "Liam", "Olivia", "Noah", "Ava", "Oliver", "Sophia", "Elijah", "Charlotte", "William",
          "James", "Benjamin", "Lucas", "Henry", "Alexander", "Mason", "Michael", "Ethan", "Daniel", "Matthew",
          "Amelia", "Harper", "Evelyn", "Abigail", "Emily", "Elizabeth", "Mila", "Ella", "Avery", "Sofia",
          "Camila", "Aria", "Scarlett", "Victoria", "Madison", "Luna", "Grace", "Chloe", "Penelope", "Layla"
        ]);
        
        const lastName = getRandomItem([
          "Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis", "Rodriguez", "Martinez",
          "Hernandez", "Lopez", "Gonzalez", "Wilson", "Anderson", "Thomas", "Taylor", "Moore", "Jackson", "Martin",
          "Lee", "Perez", "Thompson", "White", "Harris", "Sanchez", "Clark", "Ramirez", "Lewis", "Robinson",
          "Walker", "Young", "Allen", "King", "Wright", "Scott", "Torres", "Nguyen", "Hill", "Flores",
          "Green", "Adams", "Nelson", "Baker", "Hall", "Rivera", "Campbell", "Mitchell", "Carter", "Roberts"
        ]);
        
        const profession = getRandomItem(professions);
        const company = getRandomItem(companies);
        const location = getRandomItem(cities);
        
        // Create user
        const [newUser] = await db.insert(users).values({
          firstName,
          lastName,
          email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}${i}@example.com`,
          profileImageUrl: `https://ui-avatars.com/api/?name=${firstName}+${lastName}&background=random`,
        }).returning();
        
        // Create profile
        await db.insert(profiles).values({
          userId: newUser.id,
          bio: `${profession} at ${company}. Passionate about ${getRandomItem(interests)} and ${getRandomItem(interests)}.`,
          location,
          jobTitle: profession,
          company,
          isActive: true,
          completionPercentage: Math.floor(Math.random() * 40) + 60, // 60-100%
        });
        
        // Add skills (3-7 per user)
        const userSkills = getRandomItems([
          ...skillCategories.technical,
          ...skillCategories.creative,
          ...skillCategories.trades,
          ...skillCategories.business,
          ...skillCategories.personal
        ], Math.floor(Math.random() * 5) + 3);
        
        for (const skill of userSkills) {
          await db.insert(skills).values({
            userId: newUser.id,
            name: skill,
            proficiency: getRandomItem(["beginner", "intermediate", "advanced", "expert"]),
          });
        }
        
        // Add interests (2-6 per user)
        const userInterests = getRandomItems(interests, Math.floor(Math.random() * 5) + 2);
        
        for (const interest of userInterests) {
          await db.insert(interestsTable).values({
            userId: newUser.id,
            name: interest,
            frequency: getRandomItem(["daily", "weekly", "monthly", "occasionally"]),
          });
        }
      }
    }
    
    if (groupsToCreate > 0) {
      console.log(`👥 Creating ${groupsToCreate} additional groups...`);
      
      // Get all users for group creation
      const allUsers = await db.select().from(users);
      
      const groupNames = [
        // Professional Groups
        "Tech Entrepreneurs Network", "Data Science Professionals", "UX/UI Designers Circle", "Software Engineers Guild",
        "Healthcare Innovation Hub", "Financial Advisors Alliance", "Digital Marketing Masters", "Project Management Pros",
        "Startup Founders Forum", "Women in Tech", "Cybersecurity Experts", "AI/ML Researchers",
        
        // Industry Specific
        "Construction Professionals", "Real Estate Investors", "Restaurant Owners Network", "Retail Managers Group",
        "Automotive Technicians", "Electricians Union", "Plumbers Association", "Carpenters Guild",
        "Nurses Support Network", "Teachers Collective", "Legal Professionals", "Accountants Circle",
        
        // Hobby & Interest Groups
        "Photography Enthusiasts", "Hiking Adventures Club", "Cooking Masters", "Fitness Fanatics",
        "Book Lovers Society", "Music Producers Collective", "Gaming Community", "Travel Addicts",
        "Cycling Club", "Running Group", "Yoga Practitioners", "Art Lovers Circle",
        
        // Skill Development
        "Language Learning Exchange", "Public Speaking Club", "Creative Writing Group", "Coding Bootcamp Alumni",
        "Investment Club", "Entrepreneurship Meetup", "Leadership Development", "Career Changers Support",
        "Freelancers Network", "Remote Workers Community", "Side Hustle Entrepreneurs", "Mentorship Circle",
        
        // Community & Social
        "Volunteer Coordinators", "Environmental Activists", "Animal Rescue Volunteers", "Community Garden",
        "Local Food Enthusiasts", "Wine Tasting Society", "Coffee Aficionados", "Board Game Society",
        "Movie Critics Club", "Cultural Events Organizers", "Festival Planning Committee", "Charity Fundraisers",
        
        // Sports & Fitness
        "Weekend Warriors Basketball", "Tennis Club", "Golf Society", "Swimming Team",
        "Martial Arts Practitioners", "Crossfit Community", "Marathon Training Group", "Rock Climbing Club",
        "Soccer League", "Volleyball Team", "Baseball Fans", "Football Enthusiasts",
        
        // Creative & Arts
        "Independent Artists Collective", "Musicians Jam Session", "Theater Group", "Dance Studio Community",
        "Film Making Society", "Podcast Creators", "Content Creators Hub", "Graphic Designers Network",
        "Fashion Designers Circle", "Interior Design Enthusiasts", "Architecture Appreciation", "Craft Makers Guild"
      ];
      
      for (let i = 0; i < groupsToCreate && i < groupNames.length; i++) {
        const groupName = groupNames[i];
        const category = getRandomItem(groupCategories);
        const location = getRandomItem(cities);
        const creator = getRandomItem(allUsers);
        const memberCount = Math.floor(Math.random() * 500) + 10; // 10-510 members
        
        const descriptions = [
          `A community of ${category.toLowerCase()} enthusiasts who meet regularly to share knowledge and network.`,
          `Join us for ${category.toLowerCase()} activities, learning opportunities, and professional development.`,
          `Connect with like-minded individuals passionate about ${category.toLowerCase()} and collaboration.`,
          `An active group focused on ${category.toLowerCase()} skills development and mutual support.`,
          `Professional network for ${category.toLowerCase()} practitioners and enthusiasts in the ${location} area.`
        ];
        
        // Create group
        const [newGroup] = await db.insert(groups).values({
          name: groupName,
          description: getRandomItem(descriptions),
          category,
          location,
          memberCount,
          isPublic: Math.random() > 0.2, // 80% public groups
          createdBy: creator.id,
        }).returning();
        
        // Add some random members to the group (1-10% of member count)
        const membersToAdd = Math.min(
          Math.floor(memberCount * 0.1), 
          Math.floor(Math.random() * 20) + 5
        );
        
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
            // Ignore duplicate membership errors
          }
        }
      }
    }
    
    // Final count
    const finalUsersCount = await db.select().from(users).then(users => users.length);
    const finalGroupsCount = await db.select().from(groups).then(groups => groups.length);
    const skillsCount = await db.select().from(skills).then(skills => skills.length);
    const interestsCount = await db.select().from(interestsTable).then(interests => interests.length);
    
    console.log(`✅ Comprehensive data seeding completed!`);
    console.log(`📊 Final counts: ${finalUsersCount} users, ${finalGroupsCount} groups, ${skillsCount} skills, ${interestsCount} interests`);
    
  } catch (error) {
    console.error("❌ Error seeding comprehensive data:", error);
    throw error;
  }
}