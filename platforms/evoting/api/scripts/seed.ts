import "reflect-metadata";
import path from "node:path";
import { config } from "dotenv";

// Load env before importing DataSource
config({ path: path.resolve(__dirname, "../../../../.env") });

import { AppDataSource } from "../src/database/data-source";
import { User } from "../src/database/entities/User";
import { Group } from "../src/database/entities/Group";

interface SeedUser {
    ename: string;
    name: string;
    handle: string;
    description?: string;
    isVerified?: boolean;
}

interface SeedGroup {
    name: string;
    description: string;
    visibility: "public" | "private" | "restricted";
    isPrivate: boolean;
    charter: string;
}

const seedUsers: SeedUser[] = [
    {
        ename: "alice",
        name: "Alice Smith",
        handle: "alice",
        description: "Software engineer and voting enthusiast",
        isVerified: true,
    },
    {
        ename: "bob",
        name: "Bob Johnson",
        handle: "bob",
        description: "Community organizer",
        isVerified: true,
    },
    {
        ename: "charlie",
        name: "Charlie Brown",
        handle: "charlie",
        description: "Active voter",
        isVerified: false,
    },
    {
        ename: "diana",
        name: "Diana Prince",
        handle: "diana",
        description: "Group administrator",
        isVerified: true,
    },
    {
        ename: "eve",
        name: "Eve Wilson",
        handle: "eve",
        description: "New member",
        isVerified: false,
    },
];

const seedGroups: SeedGroup[] = [
    {
        name: "Tech Community",
        description: "A group for technology enthusiasts to vote on tech-related decisions",
        visibility: "public",
        isPrivate: false,
        charter: `# Tech Community Charter

## Purpose
This group exists to facilitate democratic decision-making on technology-related matters affecting our community.

## Membership
- Open to all community members interested in technology
- Members can propose and vote on technology initiatives

## Voting Rules
- Simple majority (>50%) required for standard decisions
- Supermajority (2/3) required for major infrastructure changes
- Minimum 24-hour voting period for all polls

## Code of Conduct
- Respect diverse technical opinions
- Base decisions on evidence and community benefit
- Transparent discussion before voting
`,
    },
    {
        name: "Local Council",
        description: "Decision-making group for local community matters",
        visibility: "public",
        isPrivate: false,
        charter: `# Local Council Charter

## Mission
To govern local community matters through transparent, democratic voting processes.

## Scope
- Community events and activities
- Resource allocation decisions
- Local policy recommendations

## Governance
- Monthly council meetings
- All members have equal voting rights
- Decisions require majority approval

## Accountability
- Meeting minutes published within 48 hours
- Vote results are public record
- Appeals process available for contested decisions
`,
    },
    {
        name: "Private Board",
        description: "Private board for internal governance",
        visibility: "private",
        isPrivate: true,
        charter: `# Private Board Charter

## Purpose
Internal governance body for confidential organizational matters.

## Confidentiality
- All discussions are private
- Voting records maintained internally
- Members agree to non-disclosure

## Decision Making
- Consensus preferred when possible
- Formal votes for major decisions
- Board chair has tie-breaking authority

## Meeting Schedule
- Weekly standing meetings
- Emergency sessions as needed
`,
    },
];

async function seed() {
    console.log("🌱 Starting database seed...\n");

    try {
        // Initialize database connection
        await AppDataSource.initialize();
        console.log("✅ Database connection established\n");

        const userRepo = AppDataSource.getRepository(User);
        const groupRepo = AppDataSource.getRepository(Group);

        // Create users
        console.log("Creating users...");
        const createdUsers: User[] = [];

        for (const userData of seedUsers) {
            // Check if user already exists
            const existingUser = await userRepo.findOne({
                where: { ename: userData.ename },
            });

            if (existingUser) {
                console.log(`  ⏭️  User "${userData.ename}" already exists, skipping`);
                createdUsers.push(existingUser);
            } else {
                const user = userRepo.create({
                    ename: userData.ename,
                    name: userData.name,
                    handle: userData.handle,
                    description: userData.description,
                    isVerified: userData.isVerified ?? false,
                    isPrivate: false,
                });
                const savedUser = await userRepo.save(user);
                console.log(`  ✅ Created user "${userData.name}" (${userData.ename})`);
                createdUsers.push(savedUser);
            }
        }

        console.log(`\n📊 Total users: ${createdUsers.length}\n`);

        // Create groups with members
        console.log("Creating groups...");

        for (let i = 0; i < seedGroups.length; i++) {
            const groupData = seedGroups[i];

            // Check if group already exists
            const existingGroup = await groupRepo.findOne({
                where: { name: groupData.name },
                relations: ["members", "admins", "participants"],
            });

            if (existingGroup) {
                console.log(`  ⏭️  Group "${groupData.name}" already exists, skipping`);
                continue;
            }

            // Assign different members and admins to each group
            let members: User[];
            let admins: User[];

            if (i === 0) {
                // Tech Community: all users are members, alice is admin
                members = createdUsers;
                admins = [createdUsers[0]]; // alice
            } else if (i === 1) {
                // Local Council: first 3 users, bob is admin
                members = createdUsers.slice(0, 3);
                admins = [createdUsers[1]]; // bob
            } else {
                // Private Board: diana and eve only, diana is admin
                members = [createdUsers[3], createdUsers[4]]; // diana, eve
                admins = [createdUsers[3]]; // diana
            }

            const group = groupRepo.create({
                name: groupData.name,
                description: groupData.description,
                visibility: groupData.visibility,
                isPrivate: groupData.isPrivate,
                charter: groupData.charter,
                owner: admins[0].id,
                members: members,
                admins: admins,
                participants: members,
            });

            await groupRepo.save(group);
            console.log(`  ✅ Created group "${groupData.name}" with ${members.length} members and charter`);
        }

        // Optionally add a custom user to all groups
        const customEname = process.argv[2];
        if (customEname) {
            console.log(`\n👤 Adding custom user to all groups...`);
            const cleanEname = customEname.replace(/^@/, "");
            
            let customUser = await userRepo.findOne({ where: { ename: cleanEname } });
            
            if (!customUser) {
                console.log(`  Creating new user with ename: ${cleanEname}`);
                customUser = userRepo.create({
                    ename: cleanEname,
                    name: "Your Name",
                    handle: cleanEname.slice(0, 8),
                    description: "Evoting platform user",
                    isVerified: true,
                    isPrivate: false,
                });
                customUser = await userRepo.save(customUser);
                console.log(`  ✅ Created user with ID: ${customUser.id}`);
            } else {
                console.log(`  ✅ Found existing user: ${customUser.name} (${customUser.id})`);
            }

            const allGroups = await groupRepo.find({
                relations: ["members", "participants"],
            });

            for (const group of allGroups) {
                const isAlreadyMember = group.members.some((m) => m.id === customUser!.id);
                
                if (isAlreadyMember) {
                    console.log(`  ⏭️  Already a member of "${group.name}"`);
                } else {
                    group.members.push(customUser);
                    group.participants.push(customUser);
                    await groupRepo.save(group);
                    console.log(`  ✅ Added to "${group.name}"`);
                }
            }
            
            console.log(`\n✅ User ${cleanEname} added to all groups`);
        }

        console.log("\n🎉 Seed completed successfully!\n");
        console.log("Summary:");
        console.log(`  - ${seedUsers.length} users`);
        console.log(`  - ${seedGroups.length} groups (with charters)`);
        if (customEname) {
            console.log(`  - Custom user ${customEname} added to all groups`);
        }
        console.log("\nYou can now start the evoting app and use these accounts.");
    } catch (error) {
        console.error("❌ Seed failed:", error);
        process.exit(1);
    } finally {
        await AppDataSource.destroy();
    }
}

seed();
