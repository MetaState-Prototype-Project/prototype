import { AppDataSource } from "../database/data-source";
import { Group } from "../database/entities/Group";
import { User } from "../database/entities/User";
import { MessageService } from "./MessageService";
import { CharterSignatureService } from "./CharterSignatureService";

export class GroupService {
    public groupRepository = AppDataSource.getRepository(Group);
    private userRepository = AppDataSource.getRepository(User);
    private messageService = new MessageService();
    private charterSignatureService = new CharterSignatureService();

    async createGroup(groupData: Partial<Group>): Promise<Group> {
        const group = this.groupRepository.create(groupData);
        const savedGroup = await this.groupRepository.save(group);
        
        // Note: Cerberus is only added when a charter is defined, not when group is created
        // This happens in updateGroupCharter when the charter content mentions Cerberus
        
        return savedGroup;
    }

    async getGroupById(id: string): Promise<Group | null> {
        return await this.groupRepository.findOne({ 
            where: { id },
            relations: ['participants']
        });
    }

    async updateGroup(id: string, groupData: Partial<Group>): Promise<Group | null> {
        // If updating the charter, we need to delete all existing signatures
        // since the charter content has changed
        if (groupData.charter !== undefined) {
            // Get the current group to check if charter is being updated
            const currentGroup = await this.getGroupById(id);
            if (currentGroup && currentGroup.charter !== groupData.charter) {
                // Charter content has changed, so delete all existing signatures
                console.log(`Charter updated for group ${id}, deleting all existing signatures`);
                await this.charterSignatureService.deleteAllSignaturesForGroup(id);
            }
        }
        
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

    async getUserGroups(userId: string): Promise<any[]> {
        console.log("Getting groups for user:", userId);
        
        // First, let's get all groups and filter manually to debug
        const allGroups = await this.groupRepository.find({
            relations: ['participants']
        });
        
        console.log("All groups found:", allGroups.length);
        allGroups.forEach(group => {
            console.log(`Group ${group.id} (${group.name}):`, {
                participants: group.participants?.map(p => p.id) || [],
                hasUser: group.participants?.some(p => p.id === userId) || false
            });
        });

        // Filter groups where user is a participant AND group has at least 3 participants
        const userGroups = allGroups.filter(group => {
            const isUserParticipant = group.participants?.some(participant => participant.id === userId);
            const hasMinimumParticipants = group.participants && group.participants.length >= 3;
            
            return isUserParticipant && hasMinimumParticipants;
        });
        
        // Add signing status for each group
        const groupsWithSigningStatus = await Promise.all(userGroups.map(async (group) => {
            // Check if user has signed the charter (if one exists)
            let hasSigned = false;
            if (group.charter && group.charter.trim() !== '') {
                try {
                    hasSigned = await this.charterSignatureService.hasUserSignedCharter(group.id, userId, group.charter);
                } catch (error) {
                    console.error(`Error checking signing status for group ${group.id}:`, error);
                    hasSigned = false;
                }
            }
            
            return {
                ...group,
                hasSigned
            };
        }));
        
        console.log("User groups found (with minimum 3 participants):", groupsWithSigningStatus.length);
        return groupsWithSigningStatus;
    }



    /**
     * Update group charter and create a system message about the change
     */
    async updateGroupCharter(groupId: string, newCharter: string, changeDescription: string): Promise<Group | null> {
        const group = await this.getGroupById(groupId);
        
        if (!group) {
            throw new Error("Group not found");
        }

        // Update the charter
        group.charter = newCharter;
        const updatedGroup = await this.groupRepository.save(group);

        // Check if Cerberus should be added based on the charter content
        await this.addCerberusToGroupIfRequired(groupId, newCharter);

        // Create a system message about the charter change
        await this.messageService.createCharterChangeMessage(groupId, changeDescription);

        return updatedGroup;
    }

    /**
     * Add participant and create a system message
     */
    async addParticipantToGroup(groupId: string, userId: string): Promise<void> {
        const group = await this.getGroupById(groupId);
        const user = await this.userRepository.findOne({ where: { id: userId } });
        
        if (group && user) {
            group.participants = [...group.participants, user];
            await this.groupRepository.save(group);

            // Create a system message about the new participant
            await this.messageService.createSystemMessage({
                text: `👋 ${user.name || user.handle} joined the group`,
                groupId,
            });
        }
    }

    /**
     * Remove participant and create a system message
     */
    async removeParticipantFromGroup(groupId: string, userId: string): Promise<void> {
        const group = await this.getGroupById(groupId);
        const user = await this.userRepository.findOne({ where: { id: userId } });
        
        if (group && user) {
            group.participants = group.participants.filter(p => p.id !== userId);
            await this.groupRepository.save(group);

            // Create a system message about the participant leaving
            await this.messageService.createSystemMessage({
                text: `👋 ${user.name || user.handle} left the group`,
                groupId,
            });
        }
    }

    /**
     * Check if a charter mentions Cerberus in its watchdog policy
     */
    private charterMentionsCerberus(charterContent: string): boolean {
        if (!charterContent) return false;
        
        // Check if the charter contains the watchdog policy section mentioning Cerberus
        const hasWatchdogSection = charterContent.toLowerCase().includes('automated watchdog policy');
        const mentionsCerberus = charterContent.toLowerCase().includes('cerberus');
        
        return hasWatchdogSection && mentionsCerberus;
    }

    /**
     * Notify that Cerberus will monitor the group if the charter requires it
     */
    async addCerberusToGroupIfRequired(groupId: string, charterContent?: string): Promise<void> {
        try {
            // Only notify if the charter mentions Cerberus in the watchdog policy
            if (!charterContent || !this.charterMentionsCerberus(charterContent)) {
                console.log("Charter does not mention Cerberus watchdog policy - skipping notification");
                return;
            }

            console.log(`Charter mentions Cerberus watchdog policy - Cerberus will monitor group ${groupId} for compliance`);

            // Create a system message about Cerberus monitoring
            await this.messageService.createSystemMessage({
                text: `🔒 Cerberus Platform will monitor this group for charter compliance as specified in the Automated Watchdog Policy. Use "cerberus trigger" to request a compliance check.`,
                groupId,
            });
        } catch (error) {
            console.error("Error setting up Cerberus monitoring notification:", error);
        }
    }

    /**
     * Ensure Cerberus monitoring is set up for all groups that have charters mentioning it
     */
    async ensureCerberusInAllGroups(): Promise<void> {
        try {
            const allGroups = await this.getAllGroups();
            console.log(`Checking ${allGroups.length} groups for Cerberus monitoring requirements...`);
            
            for (const group of allGroups) {
                // Only set up Cerberus monitoring if the group has a charter that mentions it
                if (group.charter) {
                    await this.addCerberusToGroupIfRequired(group.id, group.charter);
                }
            }
            
            console.log("Finished setting up Cerberus monitoring for groups with charter requirements");
        } catch (error) {
            console.error("Error setting up Cerberus monitoring for all groups:", error);
        }
    }
} 