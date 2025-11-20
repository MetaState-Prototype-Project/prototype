import { Worker, Job } from "bullmq";
import { PollReputationJobData, JobQueueService } from "../services/JobQueueService";
import { VotingReputationService } from "../services/VotingReputationService";
import { MessageService } from "../services/MessageService";
import { GroupService } from "../services/GroupService";
import { PollService } from "../services/PollService";
import { AppDataSource } from "../database/data-source";
import { Poll } from "../database/entities/Poll";
import { VoteReputationResult } from "../database/entities/VoteReputationResult";
import { Group } from "../database/entities/Group";
import { UserService } from "../services/UserService";

export class PollReputationWorker {
    private worker: Worker<PollReputationJobData>;
    private votingReputationService: VotingReputationService;
    private messageService: MessageService;
    private groupService: GroupService;
    private pollService: PollService;
    private userService: UserService;

    constructor(queueService: JobQueueService) {
        this.votingReputationService = new VotingReputationService();
        this.messageService = new MessageService();
        this.groupService = new GroupService();
        this.pollService = new PollService();
        this.userService = new UserService();

        this.worker = new Worker<PollReputationJobData>(
            "poll-reputation-calculation",
            async (job: Job<PollReputationJobData>) => {
                await this.processJob(job);
            },
            {
                connection: {
                    host: process.env.REDIS_HOST || "localhost",
                    port: parseInt(process.env.REDIS_PORT || "6379", 10),
                },
                concurrency: 1, // Process one job at a time to avoid conflicts
                limiter: {
                    max: 5,
                    duration: 10000, // Max 5 jobs per 10 seconds
                },
            }
        );

        this.worker.on("failed", (job, err) => {
            console.error(`Job ${job?.id} failed:`, err);
        });
    }

    private async processJob(job: Job<PollReputationJobData>): Promise<void> {
        const { pollId, groupId, eventId } = job.data;

        try {
            // Load poll
            const poll = await this.pollService.getPollById(pollId);
            if (!poll) {
                throw new Error(`Poll not found: ${pollId}`);
            }

            if (!poll.groupId) {
                throw new Error("Poll has no groupId, cannot calculate eReputation");
            }

            // Get group with charter
            const group = await this.groupService.getGroupById(poll.groupId);
            if (!group) {
                throw new Error("Group not found for poll");
            }

            if (!group.charter) {
                throw new Error("Group has no charter, cannot calculate eReputation");
            }

            // Calculate reputations for all group members
            const reputationResults = await this.votingReputationService.calculateGroupMemberReputations(
                poll.groupId,
                group.charter
            );

            // Save results
            const voteReputationResult = await this.votingReputationService.saveReputationResults(
                poll.id,
                poll.groupId,
                reputationResults
            );

            // Transmit results via web3adapter
            await this.transmitReputationResults(voteReputationResult, poll, group);

            // Create system message with eReputation results
            await this.createReputationMessage(poll, reputationResults);
        } catch (error) {
            console.error(`Error processing poll reputation job for poll ${pollId}:`, error);
            throw error; // Re-throw to mark job as failed
        }
    }

    private async transmitReputationResults(
        result: VoteReputationResult,
        poll: Poll,
        group: Group
    ): Promise<void> {
        const voteReputationResultRepository = AppDataSource.getRepository(VoteReputationResult);
        const pollRepository = AppDataSource.getRepository(Poll);
        const groupRepository = AppDataSource.getRepository(Group);

        // Reload result with relations
        const reloadedResult = await voteReputationResultRepository.findOne({
            where: { id: result.id },
            relations: ["poll", "group"]
        });

        if (!reloadedResult) {
            throw new Error(`Result not found: ${result.id}`);
        }

        let pollEntity: Poll | null = reloadedResult.poll || null;
        let groupEntity: Group | null = reloadedResult.group || null;

        if (!pollEntity && reloadedResult.pollId) {
            pollEntity = await pollRepository.findOne({
                where: { id: reloadedResult.pollId }
            });
        }

        if (!groupEntity && reloadedResult.groupId) {
            groupEntity = await groupRepository.findOne({
                where: { id: reloadedResult.groupId },
                select: ["id", "ename", "name"]
            });
        }

        if (!pollEntity) {
            throw new Error(`Poll not found: ${reloadedResult.pollId}`);
        }

        if (!groupEntity) {
            throw new Error(`Group not found: ${reloadedResult.groupId}`);
        }

        if (!groupEntity.ename) {
            throw new Error(`Group ${groupEntity.id} has no ename! This will cause ownerEnamePath to fail.`);
        }

        // Convert entity to plain object for web3adapter
        const data: any = {
            id: reloadedResult.id,
            pollId: reloadedResult.pollId,
            groupId: reloadedResult.groupId,
            results: JSON.stringify(reloadedResult.results),
            createdAt: reloadedResult.createdAt,
            updatedAt: reloadedResult.updatedAt
        };

        // Add poll with group for ownerEnamePath resolution
        data.poll = {
            id: pollEntity.id,
            groupId: pollEntity.groupId,
            group: {
                id: groupEntity.id,
                ename: groupEntity.ename,
                name: groupEntity.name
            }
        };

        if (!data.groupId) {
            data.groupId = groupEntity.id;
        }

        // Use web3adapter to sync to eVault
        const { adapter } = await import("../web3adapter/watchers/subscriber");
        await adapter.handleChange({
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
                const userEname = result.ename;
                const score = result.score;
                const justification = result.justification;

                messageLines.push(`${userName} (@${userEname}): ${score}/5`);
                messageLines.push(`  ${justification}`);
                messageLines.push(``);
            }

            const messageText = messageLines.join('\n');

            await this.messageService.createSystemMessage({
                text: messageText,
                groupId: poll.groupId,
                voteId: poll.id
            });
        } catch (error) {
            console.error(`Failed to create system message for poll ${poll.id}:`, error);
            // Don't throw - message creation failure shouldn't fail the job
        }
    }

    async close(): Promise<void> {
        await this.worker.close();
    }
}

