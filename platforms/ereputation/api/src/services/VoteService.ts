import { Repository } from "typeorm";
import { AppDataSource } from "../database/data-source";
import { Vote, VoteDataByMode } from "../database/entities/Vote";
import { Poll } from "../database/entities/Poll";
import { User } from "../database/entities/User";

export class VoteService {
    voteRepository: Repository<Vote>;
    private pollRepository: Repository<Poll>;
    private userRepository: Repository<User>;

    constructor() {
        this.voteRepository = AppDataSource.getRepository(Vote);
        this.pollRepository = AppDataSource.getRepository(Poll);
        this.userRepository = AppDataSource.getRepository(User);
    }

    /**
     * Check if a poll is eReputation-weighted
     */
    isEReputationWeighted(poll: Poll): boolean {
        if (!poll.groupId) {
            return false; // Must be a group poll
        }

        // Check votingWeight column instead of title
        return poll.votingWeight === "ereputation";
    }

    async getVoteById(id: string): Promise<Vote | null> {
        return await this.voteRepository.findOne({
            where: { id },
            relations: ["poll", "user"]
        });
    }

    async getVotesByPoll(pollId: string): Promise<Vote[]> {
        return await this.voteRepository.find({
            where: { pollId },
            relations: ["user"]
        });
    }

    async createVote(
        pollId: string,
        userId: string,
        voterId: string,
        data: VoteDataByMode
    ): Promise<Vote> {
        const poll = await this.pollRepository.findOne({ where: { id: pollId } });
        if (!poll) {
            throw new Error("Poll not found");
        }

        const user = await this.userRepository.findOne({ where: { id: userId } });
        if (!user) {
            throw new Error("User not found");
        }

        const vote = this.voteRepository.create({
            pollId,
            userId,
            voterId,
            data
        });

        return await this.voteRepository.save(vote);
    }

    async updateVote(id: string, data: VoteDataByMode): Promise<Vote> {
        const vote = await this.voteRepository.findOne({ where: { id } });
        if (!vote) {
            throw new Error("Vote not found");
        }

        vote.data = data;
        return await this.voteRepository.save(vote);
    }

    async deleteVote(id: string): Promise<void> {
        await this.voteRepository.delete(id);
    }
}
