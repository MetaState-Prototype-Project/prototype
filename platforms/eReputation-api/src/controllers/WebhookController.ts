import { Request, Response } from "express";
import { UserService } from "../services/UserService";
import { GroupService } from "../services/GroupService";
import { VoteService } from "../services/VoteService";
import { PollService } from "../services/PollService";
import { VotingReputationService } from "../services/VotingReputationService";
import { MessageService } from "../services/MessageService";
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
    messageService: MessageService;
    adapter: typeof adapter;

    constructor() {
        this.userService = new UserService();
        this.groupService = new GroupService();
        this.voteService = new VoteService();
        this.pollService = new PollService();
        this.votingReputationService = new VotingReputationService();
        this.messageService = new MessageService();
        this.adapter = adapter;
    }

    handleWebhook = async (req: Request, res: Response) => {
        const globalId = req.body.id;
        const schemaId = req.body.schemaId;
        
        try {
            // Forward to ANCHR if configured
            if (process.env.ANCHR_URL) {
                try {
                    await axios.post(
                        new URL("ereputation-api", process.env.ANCHR_URL).toString(),
                        req.body
                    );
                } catch (error) {
                    // Don't fail the webhook if ANCHR forwarding fails
                }
            }

            const mapping = Object.values(this.adapter.mapping).find(
                (m: any) => m.schemaId === schemaId
            ) as any;

            if (!mapping) {
                throw new Error("No mapping found");
            }

            // Check if this globalId is already locked (being processed)
            if (this.adapter.lockedIds.includes(globalId)) {
                return res.status(200).send();
            }

            this.adapter.addToLockedIds(globalId);

            const local = await this.adapter.fromGlobal({
                data: req.body.data,
                mapping,
            });

            let localId = await this.adapter.mappingDb.getLocalId(globalId);
            let finalLocalId = localId;

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
                let participants: User[] = [];
                if (
                    local.data.participants &&
                    Array.isArray(local.data.participants)
                ) {
                    const participantPromises = local.data.participants.map(
                        async (ref: string) => {
                            if (ref && typeof ref === "string") {
                                const userId = ref.split("(")[1].split(")")[0];
                                return await this.userService.getUserById(userId);
                            }
                            return null;
                        }
                    );

                    participants = (
                        await Promise.all(participantPromises)
                    ).filter((user: User | null): user is User => user !== null);
                }

                let adminIds = local?.data?.admins as string[] ?? []
                adminIds = adminIds.map((a) => a.includes("(") ? a.split("(")[1].split(")")[0]: a)

                if (localId) {
                    const group = await this.groupService.getGroupById(localId);
                    if (!group) {
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
                        this.adapter.addToLockedIds(existingGroup.id);
                        await this.adapter.mappingDb.storeMapping({
                            localId: existingGroup.id,
                            globalId: req.body.id,
                        });
                        finalLocalId = existingGroup.id;
                    } else {
                        const group = await this.groupService.createGroup(
                            local.data.name as string,
                            local.data.description as string,
                            local.data.owner as string,
                            adminIds,
                            participants.map(p => p.id),
                            local.data.charter as string | undefined,
                        );
                        this.adapter.addToLockedIds(group.id);
                        await this.adapter.mappingDb.storeMapping({
                            localId: group.id,
                            globalId: req.body.id,
                        });
                        finalLocalId = group.id;
                    }
                }
            } else if (mapping.tableName === "votes") {
                if (localId) {
                    const vote = await this.voteService.getVoteById(localId);
                    if (!vote) {
                        return res.status(500).send();
                    }

                    vote.data = local.data.data as any;
                    vote.voterId = local.data.voterId as string;
                    await this.voteService.voteRepository.save(vote);
                    finalLocalId = vote.id;
                } else {
                    // Get userId from voterId or local.data.userId
                    const userId = local.data.userId as string;
                    const voterId = local.data.voterId as string;
                    const pollId = local.data.pollId as string;
                    const voteData = local.data.data as any;

                    if (!userId || !voterId || !pollId || !voteData) {
                        return res.status(400).send();
                    }

                    const vote = await this.voteService.createVote(
                        pollId,
                        userId,
                        voterId,
                        voteData
                    );
                    this.adapter.addToLockedIds(vote.id);
                    await this.adapter.mappingDb.storeMapping({
                        localId: vote.id,
                        globalId: req.body.id,
                    });
                    finalLocalId = vote.id;
                }
            } else if (mapping.tableName === "polls") {
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

                        // Process eReputation calculation if needed
                        if (this.voteService.isEReputationWeighted(poll) && poll.groupId) {
                            this.processEReputationWeightedPoll(poll).catch((error) => {
                                console.error(`Error processing eReputation for poll ${poll.id}:`, error);
                            });
                        }
                    }
                } else {
                    // Create new poll
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
                    
                    this.adapter.addToLockedIds(savedPoll.id);
                    await this.adapter.mappingDb.storeMapping({
                        localId: savedPoll.id,
                        globalId: req.body.id,
                    });
                    finalLocalId = savedPoll.id;

                    // Process eReputation calculation if needed
                    if (this.voteService.isEReputationWeighted(savedPoll) && savedPoll.groupId) {
                        this.processEReputationWeightedPoll(savedPoll).catch((error) => {
                            console.error(`Error processing eReputation for poll ${savedPoll.id}:`, error);
                        });
                    }
                }
            }
            
            res.status(200).send();
        } catch (e) {
            console.error("Webhook error:", e);
            res.status(500).send();
        }
    };

    private async processEReputationWeightedPoll(poll: Poll): Promise<void> {
        if (!poll.groupId) return;

        const group = await this.groupService.getGroupById(poll.groupId);
        if (!group || !group.charter) return;

        const reputationResults = await this.votingReputationService.calculateGroupMemberReputations(
            poll.groupId,
            group.charter
        );

        const voteReputationResult = await this.votingReputationService.saveReputationResults(
            poll.id,
            poll.groupId,
            reputationResults
        );

        await this.transmitReputationResults(voteReputationResult, poll, group);
        await this.createReputationMessage(poll, reputationResults);
    }

    private async transmitReputationResults(
        result: VoteReputationResult,
        poll: Poll,
        group: Group
    ): Promise<void> {
        const voteReputationResultRepository = AppDataSource.getRepository(VoteReputationResult);
        const pollRepository = AppDataSource.getRepository(Poll);
        const groupRepository = AppDataSource.getRepository(Group);

        const reloadedResult = await voteReputationResultRepository.findOne({
            where: { id: result.id },
            relations: ["poll", "group"]
        });

        if (!reloadedResult) throw new Error(`Result not found: ${result.id}`);

        let pollEntity: Poll | null = reloadedResult.poll || null;
        let groupEntity: Group | null = reloadedResult.group || null;

        if (!pollEntity && reloadedResult.pollId) {
            pollEntity = await pollRepository.findOne({ where: { id: reloadedResult.pollId } });
        }

        if (!groupEntity && reloadedResult.groupId) {
            groupEntity = await groupRepository.findOne({
                where: { id: reloadedResult.groupId },
                select: ["id", "ename", "name"]
            });
        }

        if (!pollEntity || !groupEntity || !groupEntity.ename) {
            throw new Error("Missing required data for transmission");
        }

        const data: any = {
            id: reloadedResult.id,
            pollId: reloadedResult.pollId,
            groupId: reloadedResult.groupId,
            results: JSON.stringify(reloadedResult.results),
            createdAt: reloadedResult.createdAt,
            updatedAt: reloadedResult.updatedAt,
            poll: {
                id: pollEntity.id,
                groupId: pollEntity.groupId,
                group: {
                    id: groupEntity.id,
                    ename: groupEntity.ename,
                    name: groupEntity.name
                }
            }
        };

        if (!data.groupId) {
            data.groupId = groupEntity.id;
        }

        await this.adapter.handleChange({
            data,
            tableName: "vote_reputation_results"
        });
    }

    private async createReputationMessage(
        poll: Poll,
        reputationResults: Array<{ ename: string; score: number; justification: string }>
    ): Promise<void> {
        if (!poll.groupId) return;

        try {
            const messageLines: string[] = [];
            messageLines.push(`eReputation scores calculated for poll: "${poll.title}"`);
            messageLines.push(``);

            for (const result of reputationResults) {
                const user = await this.userService.getUserByEname(result.ename);
                const userName = user?.name || "Unknown";
                messageLines.push(`${userName} (@${result.ename}): ${result.score}/5`);
                messageLines.push(`  ${result.justification}`);
                messageLines.push(``);
            }

            await this.messageService.createSystemMessage({
                text: messageLines.join('\n'),
                groupId: poll.groupId,
                voteId: poll.id
            });
        } catch (error) {
            console.error(`Failed to create system message for poll ${poll.id}:`, error);
        }
    }
}
