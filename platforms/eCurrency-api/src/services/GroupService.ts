import { Repository, In } from "typeorm";
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

    // Group CRUD Operations
    async findGroupByMembers(memberIds: string[]): Promise<Group | null> {
        if (memberIds.length === 0) {
            return null;
        }

        // Use a more efficient query to find groups with exactly these members
        const sortedMemberIds = memberIds.sort();
        
        // First, try to find groups that have exactly 2 members (for DMs)
        if (sortedMemberIds.length === 2) {
            const groups = await this.groupRepository
                .createQueryBuilder("group")
                .leftJoinAndSelect("group.members", "members")
                .where("group.isPrivate = :isPrivate", { isPrivate: true })
                .andWhere("group.name LIKE :namePattern", { namePattern: "eCurrency Chat%" })
                .getMany();

            // Filter groups that have exactly the same 2 members
            for (const group of groups) {
                if (group.members.length === 2) {
                    const groupMemberIds = group.members.map((m: User) => m.id).sort();
                    
                    if (groupMemberIds.length === sortedMemberIds.length &&
                        groupMemberIds.every((id: string, index: number) => id === sortedMemberIds[index])) {
                        return group;
                    }
                }
            }
        }

        // Fallback to general search for other group sizes
        const groups = await this.groupRepository
            .createQueryBuilder("group")
            .leftJoinAndSelect("group.members", "members")
            .where("group.isPrivate = :isPrivate", { isPrivate: true })
            .getMany();

        // Filter groups that have exactly the same members (order doesn't matter)
        for (const group of groups) {
            const groupMemberIds = group.members.map((m: User) => m.id).sort();
            
            if (groupMemberIds.length === sortedMemberIds.length &&
                groupMemberIds.every((id: string, index: number) => id === sortedMemberIds[index])) {
                return group;
            }
        }

        return null;
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
        adminIds: string[] = [],
        memberIds: string[] = [],
        charter?: string,
        isPrivate: boolean = false,
        visibility: "public" | "private" | "restricted" = "public",
        avatarUrl?: string,
        bannerUrl?: string,
        originalMatchParticipants?: string[],
    ): Promise<Group> {
        // For eCurrency Chat groups, check if a DM already exists between these users
        if (isPrivate && name.startsWith("eCurrency Chat") && memberIds.length === 2) {
            const existingDM = await this.findGroupByMembers(memberIds);
            if (existingDM) {
                console.log(`⚠️ DM already exists between users ${memberIds.join(", ")}, returning existing DM: ${existingDM.id}`);
                return existingDM;
            }
        }

        const members = await this.userRepository.findBy({
            id: In(memberIds),
        });
        if (members.length !== memberIds.length) {
            throw new Error("One or more members not found");
        }

        const admins = await this.userRepository.findBy({
            id: In(adminIds),
        });
        if (admins.length !== adminIds.length) {
            throw new Error("One or more admins not found");
        }

        const group = this.groupRepository.create({
            name,
            description,
            owner,
            charter,
            members,
            admins,
            participants: members, // Also set participants for compatibility
            isPrivate,
            visibility,
            avatarUrl,
            bannerUrl,
            originalMatchParticipants: originalMatchParticipants || [],
        });
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

    async searchGroups(query: string, limit: number = 10): Promise<Group[]> {
        return await this.groupRepository
            .createQueryBuilder("group")
            .where("group.name ILIKE :query OR group.description ILIKE :query", { query: `%${query}%` })
            .limit(limit)
            .getMany();
    }

    async isGroupAdmin(groupId: string, userId: string): Promise<boolean> {
        const group = await this.groupRepository.findOne({
            where: { id: groupId },
            relations: ["admins"]
        });
        if (!group) return false;
        return group.admins.some(admin => admin.id === userId);
    }
}

