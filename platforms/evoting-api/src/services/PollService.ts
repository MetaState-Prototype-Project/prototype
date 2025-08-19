import { Repository } from "typeorm";
import { AppDataSource } from "../database/data-source";
import { Poll } from "../database/entities/Poll";
import { User } from "../database/entities/User";
import { MessageService } from "./MessageService";

export class PollService {
    private pollRepository: Repository<Poll>;
    private userRepository: Repository<User>;
    private messageService: MessageService;

    constructor() {
        this.pollRepository = AppDataSource.getRepository(Poll);
        this.userRepository = AppDataSource.getRepository(User);
        this.messageService = new MessageService();
    }

    async getAllPolls(): Promise<Poll[]> {
        return await this.pollRepository.find({
            relations: ["creator"],
            order: { createdAt: "DESC" }
        });
    }

    async getPollById(id: string): Promise<Poll | null> {
        return await this.pollRepository.findOne({
            where: { id },
            relations: ["creator"]
        });
    }

    async createPoll(pollData: {
        title: string;
        mode: string;
        visibility: string;
        options: string[];
        deadline?: string;
        creatorId: string;
        groupId?: string; // Optional groupId for system messages
    }): Promise<Poll> {
        const creator = await this.userRepository.findOne({
            where: { id: pollData.creatorId }
        });

        if (!creator) {
            throw new Error("Creator not found");
        }

        const poll = this.pollRepository.create({
            title: pollData.title,
            mode: pollData.mode as "normal" | "point" | "rank",
            visibility: pollData.visibility as "public" | "private",
            options: pollData.options,
            deadline: pollData.deadline ? new Date(pollData.deadline) : null,
            creator,
            creatorId: pollData.creatorId
        });

        const savedPoll = await this.pollRepository.save(poll);

        // Create a system message about the new vote
        if (pollData.groupId) {
            await this.messageService.createVoteCreatedMessage(pollData.groupId, pollData.title, savedPoll.id, creator.name, savedPoll.deadline);
        }

        return savedPoll;
    }

    async updatePoll(id: string, pollData: Partial<Poll>): Promise<Poll | null> {
        await this.pollRepository.update(id, pollData);
        return await this.getPollById(id);
    }

    async deletePoll(id: string): Promise<boolean> {
        const result = await this.pollRepository.delete(id);
        return result.affected !== 0;
    }

    async getPollsByCreator(creatorId: string): Promise<Poll[]> {
        return await this.pollRepository.find({
            where: { creator: { id: creatorId } },
            relations: ["creator"],
            order: { createdAt: "DESC" }
        });
    }

    /**
     * Check for expired polls and create deadline system messages
     */
    async checkExpiredPolls(): Promise<void> {
        const now = new Date();
        
        // Find all polls with deadlines that have passed
        const expiredPolls = await this.pollRepository.find({
            where: {
                deadline: { $lt: now } as any, // TypeORM syntax for less than
                // Add a flag to track if deadline message was sent
            },
            relations: ["creator"]
        });

        for (const poll of expiredPolls) {
            // Check if we need to create a deadline message
            // This could be enhanced with a flag to prevent duplicate messages
            try {
                // For now, we'll create a message for each expired poll
                // In production, you might want to add a 'deadlineMessageSent' flag
                if (poll.groupId && poll.deadline) {
                    await this.messageService.createVoteDeadlineMessage(
                        poll.groupId,
                        poll.title,
                        poll.id,
                        poll.creator.name,
                        poll.deadline
                    );
                }
            } catch (error) {
                console.error(`Failed to create deadline message for poll ${poll.id}:`, error);
            }
        }
    }



    /**
     * Get polls by group ID
     */
    async getPollsByGroup(groupId: string): Promise<Poll[]> {
        return await this.pollRepository.find({
            where: { groupId },
            relations: ["creator"],
            order: { createdAt: "DESC" }
        });
    }
} 