import { Repository } from "typeorm";
import { AppDataSource } from "../database/data-source";
import { Poll } from "../database/entities/Poll";
import { User } from "../database/entities/User";

export class PollService {
    private pollRepository: Repository<Poll>;
    private userRepository: Repository<User>;

    constructor() {
        this.pollRepository = AppDataSource.getRepository(Poll);
        this.userRepository = AppDataSource.getRepository(User);
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

        return await this.pollRepository.save(poll);
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
} 