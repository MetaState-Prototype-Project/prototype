import { Repository } from "typeorm";
import { AppDataSource } from "../database/data-source";
import { Group } from "../database/entities/Group";
import { User } from "../database/entities/User";

export class GroupService {
    groupRepository: Repository<Group>;
    userRepository: Repository<User>;

    constructor() {
        this.groupRepository = AppDataSource.getRepository(Group);
        this.userRepository = AppDataSource.getRepository(User);
    }

    async getGroupById(id: string): Promise<Group | null> {
        return await this.groupRepository.findOne({ 
            where: { id },
            relations: ["members", "admins", "participants"]
        });
    }

    async createGroup(
        name: string,
        description: string,
        owner: string,
        adminIds: string[],
        participantIds: string[],
        charter?: string
    ): Promise<Group> {
        const group = this.groupRepository.create({
            name,
            description,
            owner,
            charter,
        });

        // Add admins
        if (adminIds.length > 0) {
            const admins = await this.userRepository.findByIds(adminIds);
            group.admins = admins;
        }

        // Add participants
        if (participantIds.length > 0) {
            const participants = await this.userRepository.findByIds(participantIds);
            group.participants = participants;
        }

        return await this.groupRepository.save(group);
    }

    async updateGroup(id: string, updateData: Partial<Group>): Promise<Group> {
        await this.groupRepository.update(id, updateData);
        const updatedGroup = await this.groupRepository.findOneBy({ id });
        if (!updatedGroup) {
            throw new Error("Group not found after update");
        }
        return updatedGroup;
    }

    async getUserGroups(userId: string): Promise<Group[]> {
        return await this.groupRepository
            .createQueryBuilder("group")
            .leftJoinAndSelect("group.members", "members")
            .leftJoinAndSelect("group.admins", "admins")
            .leftJoinAndSelect("group.participants", "participants")
            .where("members.id = :userId OR admins.id = :userId OR participants.id = :userId", { userId })
            .getMany();
    }
}
