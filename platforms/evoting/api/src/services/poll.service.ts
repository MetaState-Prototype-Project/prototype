import { AppDataSource } from "../database/data-source";
import { Poll } from "../database/entities/Poll";
import { User } from "../database/entities/User";
import {
    type PointVoteData,
    type RankVoteData,
    Vote,
    type VoteDataByMode,
} from "../database/entities/Vote";

export function isValidRankVote(
    data: unknown,
    pollOptions: string[],
): data is RankVoteData {
    if (!Array.isArray(data) || data.length !== pollOptions.length)
        return false;

    const optionSet = new Set(data.map((d) => d.option));
    const pointSet = new Set(data.map((d) => d.points));

    return (
        optionSet.size === pollOptions.length &&
        pointSet.size === pollOptions.length &&
        data.every(
            (d) =>
                typeof d.option === "string" &&
                typeof d.points === "number" &&
                pollOptions.includes(d.option) &&
                d.points >= 1 &&
                d.points <= pollOptions.length,
        )
    );
}

export function isValidPointVote(
    data: unknown,
    pollOptions: string[],
): data is PointVoteData {
    return (
        Array.isArray(data) &&
        data.length > 0 &&
        new Set(data.map((d) => d.option)).size === data.length &&
        data.every(
            (d) =>
                typeof d.option === "string" &&
                typeof d.points === "number" &&
                pollOptions.includes(d.option),
        )
    );
}

export class PollService {
    private pollRepository = AppDataSource.getRepository(Poll);
    private voteRepository = AppDataSource.getRepository(Vote);
    private userRepository = AppDataSource.getRepository(User);

    // Create a new poll
    async createPoll(
        title: string,
        mode: "normal" | "point" | "rank",
        visibility: "public" | "private",
        options: string[],
        deadline?: Date,
        groupId?: string,
    ): Promise<Poll> {
        console.log('🔍 poll.service.createPoll called with:', { title, mode, visibility, options, deadline, groupId });
        
        if (options.length < 2) {
            throw new Error("At least two options are required");
        }

        const pollData = {
            title,
            mode,
            visibility,
            options,
            deadline: deadline ?? null,
            groupId: groupId ?? null,
        };
        console.log('🔍 Creating poll entity with data:', pollData);

        const poll = this.pollRepository.create(pollData);
        console.log('🔍 Poll entity created:', poll);

        const savedPoll = await this.pollRepository.save(poll);
        console.log('🔍 Poll saved to database:', savedPoll);
        
        return savedPoll;
    }

    // Get a poll by ID
    async getPollById(pollId: string): Promise<Poll | null> {
        return await this.pollRepository.findOne({
            where: { id: pollId },
            relations: ["votes"],
        });
    }

    // Get all polls (optionally by visibility)
    async getPolls(visibility?: "public" | "private"): Promise<Poll[]> {
        return this.pollRepository.find({
            where: visibility ? { visibility } : {},
            relations: ["votes"],
        });
    }

    // Cast a vote
    async castVote(
        pollId: string,
        userId: string,
        data: VoteDataByMode, // should be validated before calling
    ): Promise<Vote> {
        const poll = await this.getPollById(pollId);
        if (!poll) throw new Error("Poll not found");

        const now = new Date();
        if (poll.deadline && poll.deadline < now) {
            throw new Error("Poll has expired");
        }

        const user = await this.userRepository.findOneBy({ id: userId });
        if (!user) throw new Error("User not found");

        // Check if user already voted
        const existing = await this.voteRepository.findOneBy({
            pollId,
            voterId: userId,
        });
        if (existing) throw new Error("User has already voted");

        // Validate data based on poll mode
        switch (poll.mode) {
            case "normal":
                if (
                    !Array.isArray(data) ||
                    data.length === 0 ||
                    data.some(
                        (d) =>
                            typeof d !== "string" || !poll.options.includes(d),
                    )
                ) {
                    throw new Error("Invalid vote for normal mode");
                }
                break;
            case "point":
                if (
                    !Array.isArray(data) ||
                    data.length === 0 ||
                    data.some(
                        (d) =>
                            typeof d.option !== "string" ||
                            typeof d.points !== "number" ||
                            !poll.options.includes(d.option),
                    )
                ) {
                    throw new Error("Invalid vote for point mode");
                }
                break;
            case "rank":
                if (
                    !Array.isArray(data) ||
                    data.length !== poll.options.length ||
                    data.some((d) => typeof d !== "string") ||
                    new Set(data).size !== data.length ||
                    data.some((option) => !poll.options.includes(option))
                ) {
                    throw new Error("Invalid vote for rank mode");
                }
                break;
        }

        const vote = this.voteRepository.create({
            pollId,
            userId: user.id,
            voterId: user.ename, // Use ename for consistency with other vote creation methods
            data,
        });

        return await this.voteRepository.save(vote);
    }

    // Get votes for a poll
    async getVotes(pollId: string): Promise<Vote[]> {
        return await this.voteRepository.find({
            where: { pollId },
        });
    }

    // Get vote count
    async getVoteCount(pollId: string): Promise<number> {
        return await this.voteRepository.count({
            where: { pollId },
        });
    }

    // Optional: remove vote (e.g., allow user to change vote)
    async removeVote(pollId: string, userId: string): Promise<void> {
        await this.voteRepository.delete({
            pollId,
            voterId: userId,
        });
    }

    // Optional: close poll early
    async closePoll(pollId: string): Promise<Poll> {
        const poll = await this.getPollById(pollId);
        if (!poll) throw new Error("Poll not found");

        poll.deadline = new Date();
        return await this.pollRepository.save(poll);
    }
}
