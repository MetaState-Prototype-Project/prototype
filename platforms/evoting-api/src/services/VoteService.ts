import { Repository } from "typeorm";
import { AppDataSource } from "../database/data-source";
import { Vote } from "../database/entities/Vote";
import { Poll } from "../database/entities/Poll";
import { User } from "../database/entities/User";

export class VoteService {
    private voteRepository: Repository<Vote>;
    private pollRepository: Repository<Poll>;
    private userRepository: Repository<User>;

    constructor() {
        this.voteRepository = AppDataSource.getRepository(Vote);
        this.pollRepository = AppDataSource.getRepository(Poll);
        this.userRepository = AppDataSource.getRepository(User);
    }

    async createVote(voteData: {
        pollId: string;
        userId: string;
        optionId: number;
    }): Promise<Vote> {
        const poll = await this.pollRepository.findOne({
            where: { id: voteData.pollId }
        });

        const user = await this.userRepository.findOne({
            where: { id: voteData.userId }
        });

        if (!poll) {
            throw new Error("Poll not found");
        }

        if (!user) {
            throw new Error("User not found");
        }

        // Check if user has already voted on this poll
        const existingVote = await this.voteRepository.findOne({
            where: {
                poll: { id: voteData.pollId },
                user: { id: voteData.userId }
            }
        });

        if (existingVote) {
            throw new Error("User has already voted on this poll");
        }

        const vote = this.voteRepository.create({
            poll,
            user,
            pollId: voteData.pollId,
            userId: voteData.userId,
            voterId: voteData.userId,
            data: { 
                mode: "normal" as const,
                data: [voteData.optionId.toString()]
            }
        });

        return await this.voteRepository.save(vote);
    }

    async getVotesByPoll(pollId: string): Promise<Vote[]> {
        return await this.voteRepository.find({
            where: { poll: { id: pollId } },
            relations: ["user", "poll"]
        });
    }

    async getUserVote(pollId: string, userId: string): Promise<Vote | null> {
        return await this.voteRepository.findOne({
            where: {
                poll: { id: pollId },
                user: { id: userId }
            },
            relations: ["user", "poll"]
        });
    }

    async getPollResults(pollId: string): Promise<any> {
        const votes = await this.getVotesByPoll(pollId);
        const poll = await this.pollRepository.findOne({
            where: { id: pollId }
        });

        if (!poll) {
            throw new Error("Poll not found");
        }

        // Count votes for each option
        const voteCounts: { [key: number]: number } = {};
        poll.options.forEach((_, index) => {
            voteCounts[index] = 0;
        });

        votes.forEach(vote => {
            if (vote.data.mode === "normal" && Array.isArray(vote.data.data)) {
                vote.data.data.forEach(optionIdStr => {
                    const optionId = parseInt(optionIdStr);
                    if (!isNaN(optionId) && optionId >= 0 && optionId < poll.options.length) {
                        voteCounts[optionId]++;
                    }
                });
            }
        });

        return {
            poll,
            totalVotes: votes.length,
            results: poll.options.map((option, index) => ({
                option,
                votes: voteCounts[index] || 0,
                percentage: votes.length > 0 ? ((voteCounts[index] || 0) / votes.length) * 100 : 0
            }))
        };
    }
} 