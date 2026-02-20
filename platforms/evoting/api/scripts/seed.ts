import "reflect-metadata";
import path from "node:path";
import { config } from "dotenv";

// Load env before importing DataSource
config({ path: path.resolve(__dirname, "../../../../.env") });

import { AppDataSource } from "../src/database/data-source";
import { User } from "../src/database/entities/User";
import { Group } from "../src/database/entities/Group";
import { Poll } from "../src/database/entities/Poll";
import { Vote, VoteDataByMode } from "../src/database/entities/Vote";

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

interface SeedPoll {
    title: string;
    mode: "normal" | "point" | "rank";
    visibility: "public" | "private";
    votingWeight: "1p1v" | "ereputation";
    options: string[];
    deadlineDaysFromNow: number; // negative = already ended
    groupIndex: number; // index into seedGroups
    creatorIndex: number; // index into seedUsers
    hasVotes: boolean; // whether to generate sample votes
}

const seedPolls: SeedPoll[] = [
    // ===== PUBLIC POLLS =====
    // Public Normal Vote (Active)
    {
        title: "What programming language should we adopt for the new project?",
        mode: "normal",
        visibility: "public",
        votingWeight: "1p1v",
        options: ["TypeScript", "Python", "Rust", "Go"],
        deadlineDaysFromNow: 7,
        groupIndex: 0, // Tech Community
        creatorIndex: 0, // alice
        hasVotes: true,
    },
    // Public Normal Vote (Ended)
    {
        title: "Should we switch to a new CI/CD platform?",
        mode: "normal",
        visibility: "public",
        votingWeight: "1p1v",
        options: ["Yes", "No", "Need more research"],
        deadlineDaysFromNow: -3, // ended 3 days ago
        groupIndex: 0,
        creatorIndex: 1, // bob
        hasVotes: true,
    },
    // Public Point-Based Vote (Active)
    {
        title: "How should we allocate the Q2 tech budget?",
        mode: "point",
        visibility: "public",
        votingWeight: "1p1v",
        options: ["Server Infrastructure", "Developer Tools", "Training", "Security Audits", "Open Source Contributions"],
        deadlineDaysFromNow: 14,
        groupIndex: 0,
        creatorIndex: 0,
        hasVotes: true,
    },
    // Public Rank-Based Vote (Active)
    {
        title: "Rank your preferred conference topics",
        mode: "rank",
        visibility: "public",
        votingWeight: "1p1v",
        options: ["AI/ML Applications", "Cloud Architecture", "DevOps Best Practices", "Security Fundamentals", "Frontend Frameworks"],
        deadlineDaysFromNow: 10,
        groupIndex: 0,
        creatorIndex: 2, // charlie
        hasVotes: true,
    },
    // Public Rank-Based Vote (Ended)
    {
        title: "Which team building activity do you prefer?",
        mode: "rank",
        visibility: "public",
        votingWeight: "1p1v",
        options: ["Escape Room", "Cooking Class", "Outdoor Adventure", "Game Night"],
        deadlineDaysFromNow: -5,
        groupIndex: 1, // Local Council
        creatorIndex: 1,
        hasVotes: true,
    },

    // ===== PRIVATE BLIND POLLS =====
    // Private Normal Vote (Cryptographically protected - Active)
    {
        title: "[Blind] Confidential: Vote on leadership candidate",
        mode: "normal",
        visibility: "private",
        votingWeight: "1p1v",
        options: ["Candidate A", "Candidate B", "Abstain"],
        deadlineDaysFromNow: 5,
        groupIndex: 2, // Private Board
        creatorIndex: 3, // diana
        hasVotes: false, // blind voting requires special flow
    },
    // Private Point-Based Vote (UI-hidden only - Active)
    {
        title: "[Limited Privacy] Budget priority allocation",
        mode: "point",
        visibility: "private",
        votingWeight: "1p1v",
        options: ["R&D Investment", "Marketing Expansion", "Employee Benefits", "Debt Reduction"],
        deadlineDaysFromNow: 7,
        groupIndex: 2,
        creatorIndex: 3,
        hasVotes: true,
    },
    // Private Rank-Based Vote (UI-hidden only - Active)  
    {
        title: "[Limited Privacy] Strategic initiative priority",
        mode: "rank",
        visibility: "private",
        votingWeight: "1p1v",
        options: ["Product Launch", "Market Expansion", "Cost Optimization", "Team Growth"],
        deadlineDaysFromNow: 10,
        groupIndex: 2,
        creatorIndex: 3,
        hasVotes: true,
    },
    // Private Point-Based Vote (UI-hidden only - Ended)
    {
        title: "[Limited Privacy] Q1 Initiative Scoring (Completed)",
        mode: "point",
        visibility: "private",
        votingWeight: "1p1v",
        options: ["Customer Success", "Product Quality", "Innovation", "Operational Efficiency"],
        deadlineDaysFromNow: -2,
        groupIndex: 2,
        creatorIndex: 3,
        hasVotes: true,
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

        // Create polls and votes
        console.log("\nCreating polls and votes...");

        const pollRepo = AppDataSource.getRepository(Poll);
        const voteRepo = AppDataSource.getRepository(Vote);
        const allGroups = await groupRepo.find({ relations: ["members", "participants"] });
        let pollsCreated = 0;
        let votesCreated = 0;

        for (const pollData of seedPolls) {
            // Check if poll already exists
            const existingPoll = await pollRepo.findOne({
                where: { title: pollData.title },
            });

            if (existingPoll) {
                console.log(`  ⏭️  Poll "${pollData.title.slice(0, 40)}..." already exists, skipping`);
                continue;
            }

            const group = allGroups[pollData.groupIndex];
            if (!group) {
                console.log(`  ❌ Group not found for poll "${pollData.title.slice(0, 40)}..."`);
                continue;
            }

            const creator = createdUsers[pollData.creatorIndex];
            const deadline = new Date();
            deadline.setDate(deadline.getDate() + pollData.deadlineDaysFromNow);

            const poll = pollRepo.create({
                title: pollData.title,
                mode: pollData.mode,
                visibility: pollData.visibility,
                votingWeight: pollData.votingWeight,
                options: pollData.options,
                deadline: deadline,
                deadlineMessageSent: pollData.deadlineDaysFromNow < 0,
                creatorId: creator.id,
                groupId: group.id,
            });

            const savedPoll = await pollRepo.save(poll);
            pollsCreated++;
            console.log(`  ✅ Created poll "${pollData.title.slice(0, 50)}..." (${pollData.mode}/${pollData.visibility})`);

            // Create votes if requested (skip for private normal/blind polls - those need wallet)
            if (pollData.hasVotes) {
                const eligibleVoters = group.members.filter((_, idx) => idx < 4); // Use up to 4 voters
                
                for (let voterIdx = 0; voterIdx < eligibleVoters.length; voterIdx++) {
                    const voter = eligibleVoters[voterIdx];
                    let voteData: VoteDataByMode;

                    if (pollData.mode === "normal") {
                        // Each voter picks a different option (cycling through)
                        const optionIndex = voterIdx % pollData.options.length;
                        voteData = {
                            mode: "normal",
                            data: [optionIndex.toString()]
                        };
                    } else if (pollData.mode === "point") {
                        // Each voter distributes 100 points differently
                        const pointDistribution: Record<string, number> = {};
                        const totalPoints = 100;
                        const numOptions = pollData.options.length;
                        
                        // Create a varied distribution based on voter index
                        for (let optIdx = 0; optIdx < numOptions; optIdx++) {
                            // Vary distribution based on voter: first voter prefers first option, etc.
                            const preference = (optIdx + voterIdx) % numOptions;
                            const basePoints = Math.floor(totalPoints / numOptions);
                            const bonus = preference === 0 ? (totalPoints % numOptions) + 10 : (preference === 1 ? 5 : 0);
                            const points = Math.max(0, Math.min(100, basePoints + bonus - (preference * 3)));
                            pointDistribution[optIdx.toString()] = points;
                        }
                        
                        // Normalize to ensure exactly 100 points
                        const currentTotal = Object.values(pointDistribution).reduce((a, b) => a + b, 0);
                        if (currentTotal !== 100) {
                            pointDistribution["0"] += (100 - currentTotal);
                        }
                        
                        voteData = {
                            mode: "point",
                            data: pointDistribution as any
                        };
                    } else { // rank
                        // Each voter ranks options (top 3)
                        const rankings: { option: string; points: number }[] = [];
                        const maxRanks = Math.min(3, pollData.options.length);
                        
                        for (let rank = 1; rank <= maxRanks; rank++) {
                            // Rotate preferences based on voter index
                            const optionIndex = (rank - 1 + voterIdx) % pollData.options.length;
                            rankings.push({
                                option: optionIndex.toString(),
                                points: rank
                            });
                        }
                        
                        voteData = {
                            mode: "rank",
                            data: rankings
                        };
                    }

                    const vote = voteRepo.create({
                        pollId: savedPoll.id,
                        userId: voter.id,
                        voterId: voter.id,
                        data: voteData,
                    });

                    await voteRepo.save(vote);
                    votesCreated++;
                }
                
                console.log(`    └─ Created ${eligibleVoters.length} votes`);
            }
        }

        console.log(`\n📊 Polls created: ${pollsCreated}, Votes created: ${votesCreated}\n`);

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

            const groupsToUpdate = await groupRepo.find({
                relations: ["members", "participants"],
            });

            for (const group of groupsToUpdate) {
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
        console.log(`  - ${seedPolls.length} polls (various modes: normal, point, rank)`);
        console.log(`  - Includes public and private polls with sample votes`);
        if (customEname) {
            console.log(`  - Custom user ${customEname} added to all groups`);
        }
        console.log("\nPoll types created:");
        console.log("  - Public normal/point/rank polls (active and ended)");
        console.log("  - Private blind poll (normal mode - crypto protected)");
        console.log("  - Private PBV/RBV polls (UI-hidden only - with warning)");
        console.log("\nYou can now start the evoting app and test voting.");
    } catch (error) {
        console.error("❌ Seed failed:", error);
        process.exit(1);
    } finally {
        await AppDataSource.destroy();
    }
}

seed();
