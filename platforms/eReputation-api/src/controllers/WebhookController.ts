import { Request, Response } from "express";
import { UserService } from "../services/UserService";
import { GroupService } from "../services/GroupService";
import { VoteService } from "../services/VoteService";
import { PollService } from "../services/PollService";
import { VotingReputationService } from "../services/VotingReputationService";
import { adapter } from "../web3adapter/watchers/subscriber";
import { User } from "../database/entities/User";
import { Group } from "../database/entities/Group";
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
                console.log("Processing poll with data:", local.data);

                if (localId) {
                    console.log("Updating existing poll with localId:", localId);
                    const poll = await this.pollService.getPollById(localId);
                    if (!poll) {
                        console.error("Poll not found for localId:", localId);
                        return res.status(500).send();
                    }

                    poll.title = local.data.title as string;
                    poll.mode = local.data.mode as "normal" | "point" | "rank";
                    poll.visibility = local.data.visibility as "public" | "private";
                    poll.options = local.data.options as string[];
                    poll.deadline = local.data.deadline ? new Date(local.data.deadline as string) : null;
                    poll.groupId = local.data.groupId as string | null;
                    await this.pollService.pollRepository.save(poll);
                    console.log("Updated poll:", poll.id);
                    finalLocalId = poll.id;

                    // Check if this is an eReputation-weighted poll and calculate reputations
                    if (this.voteService.isEReputationWeighted(poll) && poll.groupId) {
                        await this.processEReputationWeightedPoll(poll);
                    }
                } else {
                    console.log("Creating new poll");
                    const title = local.data.title as string;
                    const mode = local.data.mode as "normal" | "point" | "rank";
                    const visibility = local.data.visibility as "public" | "private";
                    const options = local.data.options as string[];
                    const creatorId = local.data.creatorId as string;
                    const groupId = local.data.groupId as string | null | undefined;
                    const deadline = local.data.deadline ? new Date(local.data.deadline as string) : null;

                    if (!title || !mode || !visibility || !options || !creatorId) {
                        console.error("Missing required poll fields");
                        return res.status(400).send();
                    }

                    const poll = await this.pollService.createPoll(
                        title,
                        mode,
                        visibility,
                        options,
                        creatorId,
                        groupId,
                        deadline
                    );
                    console.log("Created poll with ID:", poll.id);
                    this.adapter.addToLockedIds(poll.id);
                    await this.adapter.mappingDb.storeMapping({
                        localId: poll.id,
                        globalId: req.body.id,
                    });
                    console.log("Stored mapping for poll:", poll.id, "->", req.body.id);
                    finalLocalId = poll.id;

                    // Check if this is an eReputation-weighted poll and calculate reputations
                    if (this.voteService.isEReputationWeighted(poll) && poll.groupId) {
                        await this.processEReputationWeightedPoll(poll);
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
            console.log(`📊 Calculating eReputation for group members...`);
            const reputationResults = await this.votingReputationService.calculateGroupMemberReputations(
                poll.groupId,
                group.charter
            );

            console.log(`✅ Calculated ${reputationResults.length} reputation scores`);

            // Save results
            const voteReputationResult = await this.votingReputationService.saveReputationResults(
                poll.id,
                poll.groupId,
                reputationResults
            );

            console.log(`💾 Saved reputation results: ${voteReputationResult.id}`);

            // Transmit results via web3adapter
            await this.transmitReputationResults(voteReputationResult);

            console.log(`📤 Transmitted reputation results to eVoting`);
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
            // Convert entity to plain object for web3adapter
            const data = {
                id: result.id,
                pollId: result.pollId,
                groupId: result.groupId,
                results: result.results,
                createdAt: result.createdAt,
                updatedAt: result.updatedAt
            };

            // Use web3adapter to sync to eVault (which will send webhook to eVoting)
            await this.adapter.handleChange({
                data,
                tableName: "vote_reputation_results"
            });

            console.log(`✅ Reputation results synced via web3adapter`);
        } catch (error) {
            console.error("Error transmitting reputation results:", error);
            throw error;
        }
    }
}
