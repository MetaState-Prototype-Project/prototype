import { AppDataSource } from "../database/data-source";
import { Group } from "../database/entities/Group";
import { User } from "../database/entities/User";

export class GroupService {
    public groupRepository = AppDataSource.getRepository(Group);
    private userRepository = AppDataSource.getRepository(User);

    async createGroup(groupData: Partial<Group>): Promise<Group> {
        const group = this.groupRepository.create(groupData);
        return await this.groupRepository.save(group);
    }

    async getGroupById(id: string): Promise<Group | null> {
        return await this.groupRepository.findOne({ 
            where: { id },
            relations: ['participants'],
            select: ['id', 'name', 'charter', 'createdAt', 'updatedAt']
        });
    }

    async updateGroup(id: string, groupData: Partial<Group>): Promise<Group | null> {
        await this.groupRepository.update(id, groupData);
        return await this.getGroupById(id);
    }

    async saveGroup(group: Group): Promise<Group> {
        return await this.groupRepository.save(group);
    }

    async deleteGroup(id: string): Promise<boolean> {
        const result = await this.groupRepository.delete(id);
        return result.affected ? result.affected > 0 : false;
    }

    async getAllGroups(): Promise<Group[]> {
        return await this.groupRepository.find({
            relations: ['participants']
        });
    }

    async getUserGroups(userId: string): Promise<Group[]> {
        const allGroups = await this.groupRepository.find({
            relations: ['participants']
        });

        const userGroups = allGroups.filter(group => 
            group.participants?.some(participant => participant.id === userId)
        );
        
        console.log("User groups found:", userGroups.length);
        return userGroups;
    }

    async addParticipantToGroup(groupId: string, userId: string): Promise<void> {
        const group = await this.getGroupById(groupId);
        const user = await this.userRepository.findOne({ where: { id: userId } });
        
        if (group && user) {
            group.participants = [...group.participants, user];
            await this.groupRepository.save(group);
        }
    }

    async removeParticipantFromGroup(groupId: string, userId: string): Promise<void> {
        const group = await this.getGroupById(groupId);
        
        if (group) {
            group.participants = group.participants.filter(p => p.id !== userId);
            await this.groupRepository.save(group);
        }
    }
} 