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

        const sortedMemberIds = memberIds.sort();
        
        // For 2-member groups (DMs), use a precise query that ensures exact match
        if (sortedMemberIds.length === 2) {
            // Find groups that are private and have exactly these 2 members
            const groups = await this.groupRepository
                .createQueryBuilder("group")
                .leftJoinAndSelect("group.members", "members")
                .where("group.isPrivate = :isPrivate", { isPrivate: true })
                .andWhere((qb) => {
                    // Subquery to find groups where both members are present
                    const subQuery = qb.subQuery()
                        .select("gm.group_id")
                        .from("group_members", "gm")
                        .where("gm.user_id IN (:...memberIds)", { 
                            memberIds: sortedMemberIds 
                        })
                        .groupBy("gm.group_id")
                        .having("COUNT(DISTINCT gm.user_id) = :memberCount", { memberCount: 2 })
                        .getQuery();
                    return "group.id IN " + subQuery;
                })
                .getMany();

            // Filter groups that have exactly the same 2 members (no more, no less)
            for (const group of groups) {
                if (group.members && group.members.length === 2) {
                    const groupMemberIds = group.members.map((m: User) => m.id).sort();
                    
                    if (groupMemberIds.length === sortedMemberIds.length &&
                        groupMemberIds.every((id: string, index: number) => id === sortedMemberIds[index])) {
                        return group;
                    }
                }
            }
        }

        // Fallback: get all private groups and filter in memory
        const allPrivateGroups = await this.groupRepository
            .createQueryBuilder("group")
            .leftJoinAndSelect("group.members", "members")
            .where("group.isPrivate = :isPrivate", { isPrivate: true })
            .getMany();

        // Filter groups that have exactly the same members (order doesn't matter)
        for (const group of allPrivateGroups) {
            if (!group.members || group.members.length !== sortedMemberIds.length) {
                continue;
            }
            
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
        // For eCurrency Chat groups, use a transaction to prevent race conditions
        if (isPrivate && (name.startsWith("eCurrency Chat") || name.includes("eCurrency Chat")) && memberIds.length === 2) {
            return await AppDataSource.transaction(async (transactionalEntityManager) => {
                // Check again within transaction to prevent race conditions
                const sortedMemberIds = memberIds.sort();
                const existingGroups = await transactionalEntityManager
                    .createQueryBuilder(Group, "group")
                    .leftJoinAndSelect("group.members", "members")
                    .where("group.isPrivate = :isPrivate", { isPrivate: true })
                    .andWhere((qb) => {
                        const subQuery = qb.subQuery()
                            .select("gm.group_id")
                            .from("group_members", "gm")
                            .where("gm.user_id IN (:...memberIds)", { 
                                memberIds: sortedMemberIds 
                            })
                            .groupBy("gm.group_id")
                            .having("COUNT(DISTINCT gm.user_id) = :memberCount", { memberCount: 2 })
                            .getQuery();
                        return "group.id IN " + subQuery;
                    })
                    .getMany();

                // Check if any group has exactly these 2 members
                for (const group of existingGroups) {
                    if (group.members && group.members.length === 2) {
                        const groupMemberIds = group.members.map((m: User) => m.id).sort();
                        if (groupMemberIds.length === sortedMemberIds.length &&
                            groupMemberIds.every((id: string, index: number) => id === sortedMemberIds[index])) {
                            console.log(`⚠️ DM already exists between users ${memberIds.join(", ")}, returning existing DM: ${group.id}`);
                            return group;
                        }
                    }
                }

                // No existing group found, create new one
                const members = await transactionalEntityManager.findBy(User, {
                    id: In(memberIds),
                });
                if (members.length !== memberIds.length) {
                    throw new Error("One or more members not found");
                }

                const admins = await transactionalEntityManager.findBy(User, {
                    id: In(adminIds),
                });
                if (admins.length !== adminIds.length) {
                    throw new Error("One or more admins not found");
                }

                const group = transactionalEntityManager.create(Group, {
                    name,
                    description,
                    owner,
                    charter,
                    members,
                    admins,
                    participants: members,
                    isPrivate,
                    visibility,
                    avatarUrl,
                    bannerUrl,
                    originalMatchParticipants: originalMatchParticipants || [],
                });
                return await transactionalEntityManager.save(Group, group);
            });
        }

        // For non-DM groups, proceed normally
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

    async isUserInGroup(groupId: string, userId: string): Promise<boolean> {
        const group = await this.groupRepository.findOne({
            where: { id: groupId },
            relations: ["members", "participants", "admins"]
        });
        if (!group) return false;
        
        // Check if user is a member, participant, or admin
        return group.members.some(m => m.id === userId) ||
               group.participants.some(p => p.id === userId) ||
               group.admins.some(a => a.id === userId);
    }
}

