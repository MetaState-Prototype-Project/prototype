import { Repository } from "typeorm";
import { AppDataSource } from "../database/data-source";
import { Poll } from "../database/entities/Poll";

export class PollService {
    pollRepository: Repository<Poll>;

    constructor() {
        this.pollRepository = AppDataSource.getRepository(Poll);
    }

    async getPollById(id: string): Promise<Poll | null> {
        return await this.pollRepository.findOne({
            where: { id },
            relations: ["votes"]
        });
    }

    async createPoll(
        title: string,
        mode: "normal" | "point" | "rank",
        visibility: "public" | "private",
        options: string[],
        groupId?: string | null,
        deadline?: Date | null
    ): Promise<Poll> {
        const poll = this.pollRepository.create({
            title,
            mode,
            visibility,
            options,
            groupId: groupId || null,
            deadline: deadline || null
        });

        return await this.pollRepository.save(poll);
    }

    async updatePoll(id: string, updateData: Partial<Poll>): Promise<Poll> {
        await this.pollRepository.update(id, updateData);
        const updatedPoll = await this.pollRepository.findOne({ where: { id } });
        if (!updatedPoll) {
            throw new Error("Poll not found after update");
        }
        return updatedPoll;
    }

    async deletePoll(id: string): Promise<void> {
        await this.pollRepository.delete(id);
    }

    async getPollsByGroup(groupId: string): Promise<Poll[]> {
        return await this.pollRepository.find({
            where: { groupId },
            relations: ["votes"],
            order: { createdAt: "DESC" }
        });
    }
}

