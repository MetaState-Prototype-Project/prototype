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
        optionId?: number;
        points?: { [key: number]: number };
        ranks?: { [key: number]: number };
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

        let voteDataToStore;
        if (voteData.optionId !== undefined) {
            // Normal voting mode
            voteDataToStore = { 
                mode: "normal" as const,
                data: [voteData.optionId.toString()]
            };
        } else if (voteData.ranks) {
            // Ranked choice voting mode - convert to points (50, 35, 15)
            const rankData = Object.entries(voteData.ranks).map(([rank, optionIndex]) => {
                const rankNum = parseInt(rank);
                let points = 0;
                if (rankNum === 1) points = 50;
                else if (rankNum === 2) points = 35;
                else if (rankNum === 3) points = 15;
                
                return {
                    option: poll.options[optionIndex],
                    points: points
                };
            });
            voteDataToStore = { 
                mode: "rank" as const,
                data: rankData
            };
        } else if (voteData.points) {
            // Points-based voting mode
            const pointData = Object.entries(voteData.points)
                .filter(([optionIndex, points]) => {
                    const index = parseInt(optionIndex);
                    return index >= 0 && index < poll.options.length && points > 0;
                })
                .map(([optionIndex, points]) => {
                    const index = parseInt(optionIndex);
                    return {
                        option: poll.options[index],
                        points: points
                    };
                });
            
            voteDataToStore = { 
                mode: "point" as const,
                data: pointData
            };
        } else {
            throw new Error("Invalid vote data");
        }

        const vote = this.voteRepository.create({
            poll,
            user,
            pollId: voteData.pollId,
            userId: voteData.userId,
            voterId: voteData.userId,
            data: voteDataToStore
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
                // Normal voting: count each option
                vote.data.data.forEach(optionIdStr => {
                    const optionId = parseInt(optionIdStr);
                    if (!isNaN(optionId) && optionId >= 0 && optionId < poll.options.length) {
                        voteCounts[optionId]++;
                    }
                });
            } else if (vote.data.mode === "rank" && Array.isArray(vote.data.data)) {
                // Ranked voting: sum points for each option (50, 35, 15)
                vote.data.data.forEach((rankData: any) => {
                    const optionIndex = poll.options.indexOf(rankData.option);
                    if (optionIndex >= 0) {
                        voteCounts[optionIndex] += rankData.points || 0;
                    }
                });
            } else if (vote.data.mode === "point" && Array.isArray(vote.data.data)) {
                // Points voting: sum points for each option
                vote.data.data.forEach((pointData: any) => {
                    const optionIndex = poll.options.indexOf(pointData.option);
                    if (optionIndex >= 0) {
                        voteCounts[optionIndex] += pointData.points || 0;
                    }
                });
            }
        });

        // Calculate total for percentage calculation
        const total = poll.mode === "rank" || poll.mode === "point"
            ? Object.values(voteCounts).reduce((sum, count) => sum + count, 0)
            : votes.length;

        return {
            poll,
            totalVotes: total,
            results: poll.options.map((option, index) => ({
                option,
                votes: voteCounts[index] || 0,
                percentage: total > 0 ? ((voteCounts[index] || 0) / total) * 100 : 0
            }))
        };
    }
} 