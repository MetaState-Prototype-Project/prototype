import { Repository } from "typeorm";
import { AppDataSource } from "../database/data-source";
import { Poll } from "../database/entities/Poll";
import { User } from "../database/entities/User";
import { Group } from "../database/entities/Group";
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

    async getAllPolls(page: number = 1, limit: number = 15, search?: string, sortField: string = "deadline", sortDirection: "asc" | "desc" = "asc", userId?: string): Promise<{ polls: Poll[]; total: number; page: number; limit: number; totalPages: number }> {
        // First, get all polls that match the search criteria (without pagination)
        let whereClause: any = {};
        if (search) {
            whereClause = [
                { title: { $regex: search, $options: 'i' } as any },
                { creator: { name: { $regex: search, $options: 'i' } as any } }
            ];
        }

        // Get user's group memberships if userId is provided
        let userGroupIds: string[] = [];
        if (userId) {
            // Get groups where user is a member, admin, or participant
            const groupRepository = AppDataSource.getRepository(Group);
            const userGroups = await groupRepository
                .createQueryBuilder('group')
                .leftJoin('group.members', 'member')
                .leftJoin('group.admins', 'admin')
                .leftJoin('group.participants', 'participant')
                .where('member.id = :userId OR admin.id = :userId OR participant.id = :userId', { userId })
                .getMany();
            
            userGroupIds = userGroups.map(group => group.id);
            console.log(`User ${userId} is member/admin/participant in groups:`, userGroupIds);
        }

        const [allPolls, total] = await this.pollRepository.findAndCount({
            where: whereClause,
            relations: ["creator"],
            order: { 
                createdAt: "DESC" // Most recent first as base order
            }
        });

        // Filter polls based on user's group memberships
        let filteredPolls = allPolls;
        if (userId && userGroupIds.length > 0) {
            filteredPolls = allPolls.filter(poll => {
                // Show polls that:
                // 1. Have no groupId (public polls)
                // 2. Belong to groups where user is a member/admin/participant
                // 3. Are created by the user themselves
                return !poll.groupId || 
                       userGroupIds.includes(poll.groupId) || 
                       poll.creatorId === userId;
            });
        } else if (userId) {
            // If user has no group memberships, only show their own polls and public polls
            filteredPolls = allPolls.filter(poll => !poll.groupId || poll.creatorId === userId);
        }

        // Custom sorting based on sortField and sortDirection
        const sortedPolls = filteredPolls.sort((a, b) => {
            const now = new Date();
            const aIsActive = !a.deadline || new Date(a.deadline) > now;
            const bIsActive = !b.deadline || new Date(b.deadline) > now;
            
            // ALWAYS show active polls first, UNLESS sorting by status
            if (sortField !== "status") {
                if (aIsActive && !bIsActive) return -1;
                if (!aIsActive && bIsActive) return 1;
            }
            
            // If both are active or both are ended, apply the user's chosen sorting
            let comparison = 0;
            
            switch (sortField) {
                case "title":
                    comparison = a.title.localeCompare(b.title);
                    break;
                case "mode":
                    comparison = a.mode.localeCompare(b.mode);
                    break;
                case "visibility":
                    comparison = a.visibility.localeCompare(b.visibility);
                    break;
                case "status":
                    // When sorting by status, allow proper Active/Ended sorting
                    if (aIsActive && !bIsActive) comparison = -1;
                    else if (!aIsActive && bIsActive) comparison = 1;
                    else comparison = 0;
                    break;
                case "votes":
                    const aVotes = a.votes?.length || 0;
                    const bVotes = b.votes?.length || 0;
                    comparison = aVotes - bVotes;
                    break;
                case "deadline":
                default:
                    if (!a.deadline && !b.deadline) comparison = 0;
                    else if (!a.deadline) comparison = 1;
                    else if (!b.deadline) comparison = -1;
                    else comparison = new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
                    break;
            }
            
            // Apply sort direction
            return sortDirection === "asc" ? comparison : -comparison;
        });

        // Now apply pagination to the sorted results
        const skip = (page - 1) * limit;
        const paginatedPolls = sortedPolls.slice(skip, skip + limit);

        const totalPages = Math.ceil(filteredPolls.length / limit);

        return {
            polls: paginatedPolls,
            total: filteredPolls.length,
            page,
            limit,
            totalPages
        };
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