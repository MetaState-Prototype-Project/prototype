import { AppDataSource } from "../database/data-source";
import { Group } from "../database/entities/Group";
import { User } from "../database/entities/User";
import { In } from "typeorm";

export class GroupService {
    public groupRepository = AppDataSource.getRepository(Group);
    private userRepository = AppDataSource.getRepository(User);

    // Group CRUD Operations
    async findGroupByMembers(memberIds: string[]): Promise<Group | null> {
        if (memberIds.length === 0) {
            return null;
        }

        // Find groups that have exactly the same members
        const groups = await this.groupRepository
            .createQueryBuilder("group")
            .leftJoinAndSelect("group.members", "members")
            .getMany();

        // Filter groups that have exactly the same members (order doesn't matter)
        const sortedMemberIds = memberIds.sort();
        
        for (const group of groups) {
            const groupMemberIds = group.members.map((m: User) => m.id).sort();
            
            if (groupMemberIds.length === sortedMemberIds.length &&
                groupMemberIds.every((id: string, index: number) => id === sortedMemberIds[index])) {
                return group;
            }
        }

        return null;
    }

    async createGroup(
        name: string,
        description: string,
        owner: string,
        adminIds: string[],
        memberIds: string[],
        charter?: string,
        isPrivate: boolean = false,
        visibility: "public" | "private" | "restricted" = "public",
        avatarUrl?: string,
        bannerUrl?: string
    ): Promise<Group> {
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
        });
        return await this.groupRepository.save(group);
    }

    async getGroupById(id: string): Promise<Group | null> {
        return await this.groupRepository.findOne({
            where: { id },
            relations: ["members", "admins", "participants"],
        });
    }

    async updateGroup(
        id: string, 
        updates: Partial<{
            name: string;
            description: string;
            isPrivate: boolean;
            visibility: "public" | "private" | "restricted";
            avatarUrl: string;
            bannerUrl: string;
        }>
    ): Promise<Group> {
        const group = await this.getGroupById(id);
        if (!group) {
            throw new Error("Group not found");
        }
        
        Object.assign(group, updates);
        return await this.groupRepository.save(group);
    }

    async deleteGroup(id: string): Promise<void> {
        const group = await this.getGroupById(id);
        if (!group) {
            throw new Error("Group not found");
        }
        await this.groupRepository.softDelete(id);
    }

    // Member Operations
    async addMembers(
        groupId: string,
        memberIds: string[]
    ): Promise<Group> {
        const group = await this.getGroupById(groupId);
        if (!group) {
            throw new Error("Group not found");
        }

        const newMembers = await this.userRepository.findBy({
            id: In(memberIds),
        });
        if (newMembers.length !== memberIds.length) {
            throw new Error("One or more members not found");
        }

        group.participants = [...group.participants, ...newMembers];
        return await this.groupRepository.save(group);
    }

    async removeMember(groupId: string, userId: string): Promise<Group> {
        const group = await this.getGroupById(groupId);
        if (!group) {
            throw new Error("Group not found");
        }

        group.members = group.members.filter((m) => m.id !== userId);
        group.admins = group.admins.filter((a) => a.id !== userId);
        return await this.groupRepository.save(group);
    }

    // Admin Operations
    async addAdmins(
        groupId: string,
        adminIds: string[]
    ): Promise<Group> {
        const group = await this.getGroupById(groupId);
        if (!group) {
            throw new Error("Group not found");
        }

        // Verify the users exist
        const newAdmins = await this.userRepository.findBy({
            id: In(adminIds),
        });
        if (newAdmins.length !== adminIds.length) {
            throw new Error("One or more admins not found");
        }

        group.admins = [...group.admins, ...newAdmins];
        return await this.groupRepository.save(group);
    }

    async removeAdmin(groupId: string, userId: string): Promise<Group> {
        const group = await this.getGroupById(groupId);
        if (!group) {
            throw new Error("Group not found");
        }

        group.admins = group.admins.filter((a) => a.id !== userId);
        return await this.groupRepository.save(group);
    }

    // Utility Methods
    async getUserGroups(
        userId: string,
        page: number = 1,
        limit: number = 10
    ): Promise<{
        groups: Group[];
        total: number;
        page: number;
        totalPages: number;
    }> {
        const [groups, total] = await this.groupRepository
            .createQueryBuilder("group")
            .leftJoinAndSelect("group.members", "members")
            .leftJoinAndSelect("group.admins", "admins")
            .where("members.id = :userId", { userId })
            .orWhere("admins.id = :userId", { userId })
            .orderBy("group.updatedAt", "DESC")
            .skip((page - 1) * limit)
            .take(limit)
            .getManyAndCount();

        return {
            groups,
            total,
            page,
            totalPages: Math.ceil(total / limit),
        };
    }

    async findById(id: string): Promise<Group | null> {
        return await this.groupRepository.findOne({
            where: { id },
            relations: ["members", "admins"],
        });
    }

    async isUserMember(groupId: string, userId: string): Promise<boolean> {
        const group = await this.getGroupById(groupId);
        if (!group) return false;
        return group.participants.some(m => m.id === userId);
    }

    async isUserAdmin(groupId: string, userId: string): Promise<boolean> {
        const group = await this.getGroupById(groupId);
        if (!group) return false;
        return group.admins.some(a => a.id === userId);
    }
} 