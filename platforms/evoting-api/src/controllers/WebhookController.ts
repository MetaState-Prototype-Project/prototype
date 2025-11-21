import { Request, Response } from "express";
import { UserService } from "../services/UserService";
import { GroupService } from "../services/GroupService";
import { PollService } from "../services/PollService";
import { VoteService } from "../services/VoteService";
import { adapter } from "../web3adapter/watchers/subscriber";
import { User } from "../database/entities/User";
import { Group } from "../database/entities/Group";
import { Poll } from "../database/entities/Poll";
import { Vote } from "../database/entities/Vote";
import { VoteReputationResult, MemberReputation } from "../database/entities/VoteReputationResult";
import { AppDataSource } from "../database/data-source";
import axios from "axios";

export class WebhookController {
    userService: UserService;
    groupService: GroupService;
    pollService: PollService;
    voteService: VoteService;
    adapter: typeof adapter;

    constructor() {
        this.userService = new UserService();
        this.groupService = new GroupService();
        this.pollService = new PollService();
        this.voteService = new VoteService();
        this.adapter = adapter;
    }

    handleWebhook = async (req: Request, res: Response) => {
        try {
            console.log("Webhook received:", {
                schemaId: req.body.schemaId,
                globalId: req.body.id,
                tableName: req.body.data?.tableName
            });

            if (process.env.ANCHR_URL) {
                axios.post(
                    new URL("evoting-api", process.env.ANCHR_URL).toString(),
                    req.body
                );
            }

            const schemaId = req.body.schemaId;
            const globalId = req.body.id;
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
                }
            } else if (mapping.tableName === "vote_reputation_results") {
                console.log("Processing vote_reputation_results with data:", local.data);
                
                const voteReputationResultRepository = AppDataSource.getRepository(VoteReputationResult);
                
                // Parse results if it's a string (from Neo4j)
                let results: MemberReputation[];
                if (typeof local.data.results === "string") {
                    try {
                        results = JSON.parse(local.data.results);
                        console.log("Parsed results from JSON string:", results.length, "items");
                    } catch (error) {
                        console.error("Failed to parse results JSON:", error);
                        return res.status(400).send();
                    }
                } else if (Array.isArray(local.data.results)) {
                    results = local.data.results as MemberReputation[];
                } else {
                    console.error("Invalid results format:", typeof local.data.results);
                    return res.status(400).send();
                }
                
                // Resolve pollId from global to local ID
                let pollId: string | null = null;
                if (local.data.pollId && typeof local.data.pollId === "string") {
                    // Handle format like "polls(ID)" or direct ID
                    const pollIdValue = local.data.pollId.includes("(") 
                        ? local.data.pollId.split("(")[1].split(")")[0]
                        : local.data.pollId;
                    pollId = await this.adapter.mappingDb.getLocalId(pollIdValue);
                    if (!pollId) {
                        console.error("Poll not found for globalId:", pollIdValue);
                        return res.status(400).send();
                    }
                }
                
                // Resolve groupId from global to local ID
                let groupId: string | null = null;
                if (local.data.groupId && typeof local.data.groupId === "string") {
                    // Handle format like "groups(ID)" or direct ID
                    const groupIdValue = local.data.groupId.includes("(") 
                        ? local.data.groupId.split("(")[1].split(")")[0]
                        : local.data.groupId;
                    groupId = await this.adapter.mappingDb.getLocalId(groupIdValue);
                    if (!groupId) {
                        console.error("Group not found for globalId:", groupIdValue);
                        return res.status(400).send();
                    }
                }
                
                if (!pollId) {
                    console.error("Missing pollId:", { pollId, groupId });
                    return res.status(400).send();
                }
                
                if (localId) {
                    // Update existing result
                    const result = await voteReputationResultRepository.findOne({
                        where: { id: localId },
                        relations: ["poll", "group"]
                    });
                    
                    if (result) {
                        result.pollId = pollId;
                        result.groupId = groupId;
                        result.results = results;
                        await voteReputationResultRepository.save(result);
                        console.log("Updated vote_reputation_result:", result.id);
                    }
                } else {
                    // Create new result
                    const newResult = voteReputationResultRepository.create({
                        pollId: pollId,
                        groupId: groupId || null,
                        results: results
                    });
                    
                    const savedResult = await voteReputationResultRepository.save(newResult) as VoteReputationResult;
                    this.adapter.addToLockedIds(savedResult.id);
                    await this.adapter.mappingDb.storeMapping({
                        localId: savedResult.id,
                        globalId: req.body.id,
                    });
                    console.log("Created vote_reputation_result:", savedResult.id);
                }
            } else if (mapping.tableName === "votes") {
                console.log("Processing vote with data:", local.data);
                
                const voteRepository = AppDataSource.getRepository(Vote);
                
                // Get poll
                let poll: Poll | null = null;
                if (local.data.pollId && typeof local.data.pollId === "string") {
                    const pollId = local.data.pollId.includes("(") 
                        ? local.data.pollId.split("(")[1].split(")")[0]
                        : local.data.pollId;
                    poll = await this.pollService.getPollById(pollId);
                }
                
                if (!poll) {
                    console.error("Poll not found for vote");
                    return res.status(400).send();
                }
                
                // Get user
                let user: User | null = null;
                if (local.data.userId && typeof local.data.userId === "string") {
                    const userId = local.data.userId.includes("(") 
                        ? local.data.userId.split("(")[1].split(")")[0]
                        : local.data.userId;
                    user = await this.userService.getUserById(userId);
                }
                
                if (!user) {
                    console.error("User not found for vote");
                    return res.status(400).send();
                }
                
                if (localId) {
                    // Update existing vote
                    const vote = await voteRepository.findOne({
                        where: { id: localId },
                        relations: ["poll", "user"]
                    });
                    
                    if (vote) {
                        vote.poll = poll;
                        vote.pollId = poll.id;
                        vote.user = user;
                        vote.userId = user.id;
                        vote.voterId = local.data.voterId as string;
                        vote.data = local.data.data as any;
                        
                        await voteRepository.save(vote);
                        console.log("Updated vote:", vote.id);
                    }
                } else {
                    // Create new vote
                    const vote = voteRepository.create({
                        poll: poll,
                        pollId: poll.id,
                        user: user,
                        userId: user.id,
                        voterId: local.data.voterId as string,
                        data: local.data.data as any
                    });
                    
                    const savedVote = await voteRepository.save(vote);
                    this.adapter.addToLockedIds(savedVote.id);
                    await this.adapter.mappingDb.storeMapping({
                        localId: savedVote.id,
                        globalId: req.body.id,
                    });
                    console.log("Created vote:", savedVote.id);
                }
            }
            res.status(200).send();
        } catch (e) {
            console.error("Webhook error:", e);
            res.status(500).send();
        }
    };
}