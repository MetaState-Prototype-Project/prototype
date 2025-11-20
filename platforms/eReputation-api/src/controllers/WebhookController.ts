import { Request, Response } from "express";
import { UserService } from "../services/UserService";
import { GroupService } from "../services/GroupService";
import { VoteService } from "../services/VoteService";
import { PollService } from "../services/PollService";
import { VotingReputationService } from "../services/VotingReputationService";
import { adapter } from "../web3adapter/watchers/subscriber";
import { User } from "../database/entities/User";
import { Group } from "../database/entities/Group";
import { Poll } from "../database/entities/Poll";
import { VoteReputationResult } from "../database/entities/VoteReputationResult";
import { AppDataSource } from "../database/data-source";
import axios from "axios";

export class WebhookController {
    userService: UserService;
    groupService: GroupService;
    voteService: VoteService;
    pollService: PollService;
    votingReputationService: VotingReputationService;
    adapter: typeof adapter;

    constructor() {
        this.userService = new UserService();
        this.groupService = new GroupService();
        this.voteService = new VoteService();
        this.pollService = new PollService();
        this.votingReputationService = new VotingReputationService();
        this.adapter = adapter;
    }

    handleWebhook = async (req: Request, res: Response) => {
        const globalId = req.body.id;
        const schemaId = req.body.schemaId;
        
        try {
            console.log("🔔 eReputation Webhook received:", {
                globalId,
                schemaId,
                tableName: req.body.data?.tableName
            });

            // Forward to ANCHR if configured
            if (process.env.ANCHR_URL) {
                try {
                    await axios.post(
                        new URL("ereputation-api", process.env.ANCHR_URL).toString(),
                        req.body
                    );
                } catch (error) {
                    console.error("Failed to forward to ANCHR:", error);
                    // Don't fail the webhook if ANCHR forwarding fails
                }
            }

            const mapping = Object.values(this.adapter.mapping).find(
                (m: any) => m.schemaId === schemaId
            ) as any;

            console.log("Found mapping:", mapping?.tableName);
            console.log("Available mappings:", Object.keys(this.adapter.mapping));

            if (!mapping) {
                console.error("No mapping found for schemaId:", schemaId);
                throw new Error("No mapping found");
            }

            // Check if this globalId is already locked (being processed)
            if (this.adapter.lockedIds.includes(globalId)) {
                console.log("GlobalId already locked, skipping:", globalId);
                return res.status(200).send();
            }

            this.adapter.addToLockedIds(globalId);

            const local = await this.adapter.fromGlobal({
                data: req.body.data,
                mapping,
            });

            let localId = await this.adapter.mappingDb.getLocalId(globalId);
            console.log("Local ID for globalId", globalId, ":", localId);
            let finalLocalId = localId; // Track the final local ID for completion

            if (mapping.tableName === "users") {
                if (localId) {
                    const user = await this.userService.getUserById(localId);
                    if (!user) throw new Error();

                    // Only update simple properties, not relationships
                    const updateData: Partial<User> = {
                        name: req.body.data.displayName,
                        handle: local.data.username as string | undefined,
                        description: local.data.bio as string | undefined,
                        avatarUrl: local.data.avatarUrl as string | undefined,
                        bannerUrl: local.data.bannerUrl as string | undefined,
                        isVerified: local.data.isVerified as boolean | undefined,
                        isPrivate: local.data.isPrivate as boolean | undefined,
                        email: local.data.email as string | undefined,
                        emailVerified: local.data.emailVerified as boolean | undefined,
                    };

                    await this.userService.updateUser(user.id, updateData);
                    await this.adapter.mappingDb.storeMapping({
                        localId: user.id,
                        globalId: req.body.id,
                    });
                    this.adapter.addToLockedIds(user.id);
                    this.adapter.addToLockedIds(globalId);
                    finalLocalId = user.id;
                } else {
                    const user = await this.userService.createBlankUser(req.body.w3id);
                    
                    // Update user with webhook data
                    await this.userService.updateUser(user.id, {
                        name: req.body.data.displayName,
                        handle: req.body.data.username,
                        description: req.body.data.bio,
                        avatarUrl: req.body.data.avatarUrl,
                        bannerUrl: req.body.data.bannerUrl,
                        isVerified: req.body.data.isVerified,
                        isPrivate: req.body.data.isPrivate,
                    });

                    await this.adapter.mappingDb.storeMapping({
                        localId: user.id,
                        globalId: req.body.id,
                    });
                    this.adapter.addToLockedIds(user.id);
                    this.adapter.addToLockedIds(globalId);
                    finalLocalId = user.id;
                }
            } else if (mapping.tableName === "groups") {
                console.log("Processing group with data:", local.data);

                let participants: User[] = [];
                if (
                    local.data.participants &&
                    Array.isArray(local.data.participants)
                ) {
                    console.log("Processing participants:", local.data.participants);
                    const participantPromises = local.data.participants.map(
                        async (ref: string) => {
                            if (ref && typeof ref === "string") {
                                const userId = ref.split("(")[1].split(")")[0];
                                console.log("Extracted userId:", userId);
                                return await this.userService.getUserById(userId);
                            }
                            return null;
                        }
                    );

                    participants = (
                        await Promise.all(participantPromises)
                    ).filter((user: User | null): user is User => user !== null);
                    console.log("Found participants:", participants.length);
                }

                let adminIds = local?.data?.admins as string[] ?? []
                adminIds = adminIds.map((a) => a.includes("(") ? a.split("(")[1].split(")")[0]: a)

                if (localId) {
                    console.log("Updating existing group with localId:", localId);
                    const group = await this.groupService.getGroupById(localId);
                    if (!group) {
                        console.error("Group not found for localId:", localId);
                        return res.status(500).send();
                    }

                    group.name = local.data.name as string;
                    group.description = local.data.description as string;
                    group.owner = local.data.owner as string;
                    group.admins = adminIds.map(id => ({ id } as User));
                    group.participants = participants;
                    group.charter = local.data.charter as string;
                    group.ename = local.data.ename as string

                    this.adapter.addToLockedIds(localId);
                    await this.groupService.groupRepository.save(group);
                    console.log("Updated group:", group.id);
                    finalLocalId = group.id;
                } else {
                    // Check if a group with the same name and description already exists
                    // This prevents duplicate group creation from junction table webhooks
                    const existingGroup = await this.groupService.groupRepository.findOne({
                        where: {
                            name: local.data.name as string,
                            description: local.data.description as string
                        }
                    });

                    if (existingGroup) {
                        console.log("⏭️ Group with same name/description already exists, updating mapping instead");
                        this.adapter.addToLockedIds(existingGroup.id);
                        await this.adapter.mappingDb.storeMapping({
                            localId: existingGroup.id,
                            globalId: req.body.id,
                        });
                        console.log("Stored mapping for existing group:", existingGroup.id, "->", req.body.id);
                        finalLocalId = existingGroup.id;
                    } else {
                        console.log("Creating new group");
                        const group = await this.groupService.createGroup(
                            local.data.name as string,
                            local.data.description as string,
                            local.data.owner as string,
                            adminIds,
                            participants.map(p => p.id),
                            local.data.charter as string | undefined,
                        );
                        console.log("Created group with ID:", group.id);
                        console.log(group)
                        this.adapter.addToLockedIds(group.id);
                        await this.adapter.mappingDb.storeMapping({
                            localId: group.id,
                            globalId: req.body.id,
                        });
                        console.log("Stored mapping for group:", group.id, "->", req.body.id);
                        finalLocalId = group.id;
                    }
                }
            } else if (mapping.tableName === "votes") {
                console.log("Processing vote with data:", local.data);

                if (localId) {
                    console.log("Updating existing vote with localId:", localId);
                    const vote = await this.voteService.getVoteById(localId);
                    if (!vote) {
                        console.error("Vote not found for localId:", localId);
                        return res.status(500).send();
                    }

                    vote.data = local.data.data as any;
                    vote.voterId = local.data.voterId as string;
                    await this.voteService.voteRepository.save(vote);
                    console.log("Updated vote:", vote.id);
                    finalLocalId = vote.id;
                } else {
                    console.log("Creating new vote");
                    // Get userId from voterId or local.data.userId
                    const userId = local.data.userId as string;
                    const voterId = local.data.voterId as string;
                    const pollId = local.data.pollId as string;
                    const voteData = local.data.data as any;

                    if (!userId || !voterId || !pollId || !voteData) {
                        console.error("Missing required vote fields");
                        return res.status(400).send();
                    }

                    const vote = await this.voteService.createVote(
                        pollId,
                        userId,
                        voterId,
                        voteData
                    );
                    console.log("Created vote with ID:", vote.id);
                    this.adapter.addToLockedIds(vote.id);
                    await this.adapter.mappingDb.storeMapping({
                        localId: vote.id,
                        globalId: req.body.id,
                    });
                    console.log("Stored mapping for vote:", vote.id, "->", req.body.id);
                    finalLocalId = vote.id;
                }
            } else if (mapping.tableName === "polls") {
                console.log("📊 Processing poll webhook with data:", {
                    localId,
                    title: local.data.title,
                    votingWeight: local.data.votingWeight,
                    group: local.data.group,
                    groupId: local.data.groupId,
                    creatorId: local.data.creatorId
                });
                
                const pollRepository = AppDataSource.getRepository(Poll);
                
                // Get groupId from group reference if present
                let groupId: string | null = null;
                if (local.data.group) {
                    if (typeof local.data.group === "string" && local.data.group.includes("(")) {
                        groupId = local.data.group.split("(")[1].split(")")[0];
                    } else if (typeof local.data.group === "object" && local.data.group !== null && "id" in local.data.group) {
                        groupId = (local.data.group as { id: string }).id;
                    }
                } else if (local.data.groupId) {
                    groupId = local.data.groupId as string;
                }
                
                console.log("📊 Extracted poll data:", {
                    groupId,
                    votingWeight: local.data.votingWeight
                });
                
                if (localId) {
                    // Update existing poll
                    const poll = await pollRepository.findOne({
                        where: { id: localId }
                    });
                    
                    if (poll) {
                        poll.title = local.data.title as string;
                        poll.mode = local.data.mode as "normal" | "point" | "rank";
                        poll.visibility = local.data.visibility as "public" | "private";
                        poll.votingWeight = (local.data.votingWeight || "1p1v") as "1p1v" | "ereputation";
                        poll.options = Array.isArray(local.data.options) 
                            ? local.data.options 
                            : (local.data.options as string).split(",");
                        poll.deadline = local.data.deadline ? new Date(local.data.deadline as string) : null;
                        poll.groupId = groupId;
                        
                        await pollRepository.save(poll);
                        finalLocalId = poll.id;

                        // Check if this is an eReputation-weighted poll and calculate reputations
                        console.log(`🔍 Checking if poll is eReputation-weighted:`, {
                            pollId: poll.id,
                            votingWeight: poll.votingWeight,
                            groupId: poll.groupId,
                            isWeighted: this.voteService.isEReputationWeighted(poll)
                        });
                        if (this.voteService.isEReputationWeighted(poll) && poll.groupId) {
                            console.log(`✅ Poll is eReputation-weighted, processing...`);
                            await this.processEReputationWeightedPoll(poll);
                        } else {
                            console.log(`⏭️  Poll is not eReputation-weighted, skipping calculation`);
                        }
                    }
                } else {
                    // Create new poll
                    console.log("📝 Creating new poll...");
                    
                    const poll = pollRepository.create({
                        title: local.data.title as string,
                        mode: local.data.mode as "normal" | "point" | "rank",
                        visibility: local.data.visibility as "public" | "private",
                        votingWeight: (local.data.votingWeight || "1p1v") as "1p1v" | "ereputation",
                        options: Array.isArray(local.data.options) 
                            ? local.data.options 
                            : (local.data.options as string).split(","),
                        deadline: local.data.deadline ? new Date(local.data.deadline as string) : null,
                        groupId: groupId
                    });
                    
                    const savedPoll = await pollRepository.save(poll);
                    console.log("✅ Poll saved with ID:", savedPoll.id);
                    
                    this.adapter.addToLockedIds(savedPoll.id);
                    await this.adapter.mappingDb.storeMapping({
                        localId: savedPoll.id,
                        globalId: req.body.id,
                    });
                    finalLocalId = savedPoll.id;

                    // Check if this is an eReputation-weighted poll and calculate reputations
                    console.log(`🔍 Checking if poll is eReputation-weighted:`, {
                        pollId: savedPoll.id,
                        votingWeight: savedPoll.votingWeight,
                        groupId: savedPoll.groupId,
                        isWeighted: this.voteService.isEReputationWeighted(savedPoll)
                    });
                    if (this.voteService.isEReputationWeighted(savedPoll) && savedPoll.groupId) {
                        console.log(`✅ Poll is eReputation-weighted, processing...`);
                        await this.processEReputationWeightedPoll(savedPoll);
                    } else {
                        console.log(`⏭️  Poll is not eReputation-weighted, skipping calculation`);
                    }
                }
            }
            
            console.log(`✅ Webhook completed successfully`);
            res.status(200).send();
        } catch (e) {
            console.error("eReputation Webhook error:", e);
            res.status(500).send();
        }
    };

    /**
     * Process eReputation-weighted poll: calculate reputations and transmit to eVoting
     */
    private async processEReputationWeightedPoll(poll: any): Promise<void> {
        try {
            console.log(`🔍 Processing eReputation-weighted poll: ${poll.id}`);
            
            if (!poll.groupId) {
                console.error("Poll has no groupId, cannot calculate eReputation");
                return;
            }

            // Get group with charter
            const group = await this.groupService.getGroupById(poll.groupId);
            if (!group) {
                console.error("Group not found for poll");
                return;
            }

            if (!group.charter) {
                console.error("Group has no charter, cannot calculate eReputation");
                return;
            }

            // Calculate reputations for all group members
            console.log(`\n${"=".repeat(80)}`);
            console.log(`📊 STARTING eReputation Calculation Process`);
            console.log(`   Poll ID: ${poll.id}`);
            console.log(`   Poll Title: ${poll.title}`);
            console.log(`   Group ID: ${poll.groupId}`);
            console.log(`   Group Name: ${group.name || "N/A"}`);
            console.log(`${"=".repeat(80)}\n`);
            
            const reputationResults = await this.votingReputationService.calculateGroupMemberReputations(
                poll.groupId,
                group.charter
            );

            console.log(`\n${"=".repeat(80)}`);
            console.log(`💾 SAVING eReputation Results`);
            console.log(`   Poll ID: ${poll.id}`);
            console.log(`   Group ID: ${poll.groupId}`);
            console.log(`   Results count: ${reputationResults.length}`);
            console.log(`${"=".repeat(80)}\n`);

            // Save results
            const voteReputationResult = await this.votingReputationService.saveReputationResults(
                poll.id,
                poll.groupId,
                reputationResults
            );

            console.log(`✅ Saved reputation results with ID: ${voteReputationResult.id}`);
            console.log(`   Created at: ${voteReputationResult.createdAt}`);
            console.log(`   Updated at: ${voteReputationResult.updatedAt}`);

            // Transmit results via web3adapter
            console.log(`\n${"=".repeat(80)}`);
            console.log(`📤 TRANSMITTING eReputation Results to eVoting`);
            console.log(`   Result ID: ${voteReputationResult.id}`);
            console.log(`   Poll ID: ${voteReputationResult.pollId}`);
            console.log(`   Group ID: ${voteReputationResult.groupId}`);
            console.log(`   Results to transmit: ${voteReputationResult.results.length} member reputations`);
            console.log(`${"=".repeat(80)}\n`);
            
            await this.transmitReputationResults(voteReputationResult);

            console.log(`\n${"=".repeat(80)}`);
            console.log(`✅ SUCCESSFULLY COMPLETED eReputation Calculation & Transmission`);
            console.log(`   Poll ID: ${poll.id}`);
            console.log(`   Result ID: ${voteReputationResult.id}`);
            console.log(`   Transmitted ${voteReputationResult.results.length} reputation scores to eVoting`);
            console.log(`${"=".repeat(80)}\n`);
        } catch (error) {
            console.error("Error processing eReputation-weighted poll:", error);
            // Don't throw - we don't want to fail the webhook if reputation calculation fails
        }
    }

    /**
     * Transmit reputation results to eVoting via web3adapter
     */
    private async transmitReputationResults(result: any): Promise<void> {
        try {
            console.log(`\n${"=".repeat(80)}`);
            console.log(`📤 TRANSMITTING eReputation Results to eVoting API`);
            console.log(`${"=".repeat(80)}`);
            console.log(`   Preparing data for transmission...`);
            
            // Reload result with relations to ensure poll and group are loaded
            const voteReputationResultRepository = AppDataSource.getRepository(VoteReputationResult);
            const pollRepository = AppDataSource.getRepository(Poll);
            const groupRepository = AppDataSource.getRepository(Group);
            
            console.log(`   🔍 Reloading result with relations...`);
            console.log(`      - Result ID: ${result.id}`);
            console.log(`      - Poll ID: ${result.pollId}`);
            console.log(`      - Group ID: ${result.groupId}`);
            
            // Reload the result with poll and group relations
            const reloadedResult = await voteReputationResultRepository.findOne({
                where: { id: result.id },
                relations: ["poll", "group"]
            });
            
            if (!reloadedResult) {
                console.error(`   ❌ Result not found: ${result.id}`);
                throw new Error(`Result not found: ${result.id}`);
            }
            
            // Ensure poll and group are loaded
            let poll: Poll | null = reloadedResult.poll || null;
            let group: Group | null = reloadedResult.group || null;
            
            // If relations weren't loaded, load them manually
            if (!poll && reloadedResult.pollId) {
                poll = await pollRepository.findOne({
                    where: { id: reloadedResult.pollId }
                });
            }
            
            if (!group && reloadedResult.groupId) {
                group = await groupRepository.findOne({
                    where: { id: reloadedResult.groupId },
                    select: ["id", "ename", "name"]
                });
            }
            
            if (!poll) {
                console.error(`   ❌ Poll not found: ${reloadedResult.pollId}`);
                throw new Error(`Poll not found: ${reloadedResult.pollId}`);
            }
            
            if (!group) {
                console.error(`   ❌ Group not found: ${reloadedResult.groupId}`);
                throw new Error(`Group not found: ${reloadedResult.groupId}`);
            }
            
            console.log(`   ✅ Loaded group:`, {
                id: group.id,
                name: group.name,
                ename: group.ename || "NULL/MISSING"
            });
            
            if (!group.ename) {
                console.error(`   ⚠️  WARNING: Group ${group.id} has no ename! This will cause ownerEnamePath to fail.`);
            }
            
            // Convert entity to plain object for web3adapter, using reloaded result with relations
            // Stringify results array for Neo4j compatibility (can't store nested objects)
            const data: any = {
                id: reloadedResult.id,
                pollId: reloadedResult.pollId,
                groupId: reloadedResult.groupId,
                results: JSON.stringify(reloadedResult.results), // Stringify for Neo4j
                createdAt: reloadedResult.createdAt,
                updatedAt: reloadedResult.updatedAt
            };
            
            // Add poll with group for ownerEnamePath resolution (groups(poll.group.ename))
            // The ownerEnamePath "groups(poll.group.ename)" will extract poll.group.ename from this structure
            // We need to ensure the full structure is present for path resolution
            data.poll = {
                id: poll.id,
                groupId: poll.groupId,
                group: {
                    id: group.id,
                    ename: group.ename,
                    name: group.name
                }
            };
            
            // Also ensure groupId is set for the mapping
            if (!data.groupId) {
                data.groupId = group.id;
            }
            
            console.log(`   ✅ Results stringified for Neo4j compatibility`);
            console.log(`      - Results as JSON string length: ${data.results.length} characters`);
            
            console.log(`   ✅ Data structure prepared for ownerEnamePath resolution:`);
            console.log(`      - poll.id: ${data.poll.id}`);
            console.log(`      - poll.group.id: ${data.poll.group.id}`);
            console.log(`      - poll.group.ename: ${data.poll.group.ename || "NULL"}`);
            console.log(`      - ownerEnamePath will resolve: groups(poll.group.ename) -> ${data.poll.group.ename || "NULL"}`);
            
            // Verify the path can be resolved
            const testPath = "poll.group.ename";
            const pathParts = testPath.split(".");
            let testValue: any = data;
            for (const part of pathParts) {
                testValue = testValue?.[part];
            }
            console.log(`      - Path resolution test: poll.group.ename = ${testValue || "UNDEFINED"}`);

            console.log(`\n   📦 Data prepared for transmission:`);
            console.log(`      - Result ID: ${data.id}`);
            console.log(`      - Poll ID: ${data.pollId}`);
            console.log(`      - Group ID: ${data.groupId}`);
            console.log(`      - Results count: ${reloadedResult.results.length} (stringified for transmission)`);
            console.log(`\n   📋 Detailed eReputation Results being sent to eVoting:`);
            // Use original array for logging, not stringified version
            reloadedResult.results.forEach((memberResult: any, index: number) => {
                console.log(`\n      ${index + 1}. User ename: ${memberResult.ename}`);
                console.log(`         📊 eReputation Score: ${memberResult.score}/5`);
                console.log(`         💬 Justification: "${memberResult.justification}"`);
            });
            
            console.log(`\n   🚀 Sending via web3adapter to eVault (will forward to eVoting API)...`);
            console.log(`   📋 Final data structure being sent:`);
            console.log(`      - Has poll: ${!!data.poll}`);
            console.log(`      - Has poll.group: ${!!data.poll?.group}`);
            console.log(`      - poll.group.ename: ${data.poll?.group?.ename || "MISSING"}`);
            console.log(`      - Full data keys: ${Object.keys(data).join(", ")}`);
            if (data.poll) {
                console.log(`      - poll keys: ${Object.keys(data.poll).join(", ")}`);
                if (data.poll.group) {
                    console.log(`      - poll.group keys: ${Object.keys(data.poll.group).join(", ")}`);
                }
            }

            // Use web3adapter to sync to eVault (which will send webhook to eVoting)
            await this.adapter.handleChange({
                data,
                tableName: "vote_reputation_results"
            });

            console.log(`\n   ✅ Successfully sent to web3adapter`);
            console.log(`   ✅ Data will be synced to eVault and forwarded to eVoting API`);
            console.log(`   ✅ eVoting will receive ${data.results.length} eReputation scores for weighted voting`);
            console.log(`${"=".repeat(80)}\n`);
        } catch (error) {
            console.error(`\n   ❌ ERROR transmitting reputation results:`, error);
            throw error;
        }
    }
}
