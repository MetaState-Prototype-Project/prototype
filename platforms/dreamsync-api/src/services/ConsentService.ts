import { AppDataSource } from "../database/data-source";
import { Match, MatchStatus } from "../database/entities/Match";
import { User } from "../database/entities/User";
import { Group } from "../database/entities/Group";
import { Message } from "../database/entities/Message";
import { UserService } from "./UserService";
import { GroupService } from "./GroupService";

export class ConsentService {
    private userService: UserService;
    private groupService: GroupService;
    private processingMatches: Set<string> = new Set(); // Track matches being processed

    constructor() {
        this.userService = new UserService();
        this.groupService = new GroupService();
    }

    /**
     * Process a "yes" response to a match notification
     */
    async processConsentResponse(messageText: string, senderId: string, groupId: string): Promise<void> {
        try {
            // Check if this is a "yes" response to a system message
            if (!messageText.toLowerCase().includes('yes')) {
                return;
            }

            // Find the match notification message in this group
            const messageRepository = AppDataSource.getRepository(Message);
            const groupRepository = AppDataSource.getRepository(Group);
            
            const group = await groupRepository.findOne({
                where: { id: groupId },
                relations: ["members"]
            });

            if (!group) {
                console.error("Group not found:", groupId);
                return;
            }

            // Find the system message with match ID in this group
            const systemMessage = await messageRepository
                .createQueryBuilder("message")
                .leftJoinAndSelect("message.sender", "sender")
                .where("message.group.id = :groupId", { groupId })
                .andWhere("message.isSystemMessage = :isSystem", { isSystem: true })
                .andWhere("message.text ILIKE :pattern", { pattern: "%[Match ID:%" })
                .getOne();

            if (!systemMessage) {
                console.log("No system message with match ID found in group:", groupId);
                return;
            }

            // Extract match ID from the system message
            const matchIdMatch = systemMessage.text.match(/\[Match ID: ([^\]]+)\]/);
            if (!matchIdMatch) {
                console.error("Could not extract match ID from system message");
                return;
            }

            const matchId = matchIdMatch[1];
            console.log("Processing consent for match:", matchId);

            // Find the match
            const matchRepository = AppDataSource.getRepository(Match);
            const match = await matchRepository.findOne({
                where: { id: matchId },
                relations: ["userA", "userB"]
            });

            if (!match) {
                console.error("Match not found:", matchId);
                return;
            }

            // Determine which user gave consent
            const isUserA = match.userAId === senderId;
            const isUserB = match.userBId === senderId;

            if (!isUserA && !isUserB) {
                console.error("Sender is not part of this match:", senderId);
                return;
            }

            // Update consent
            if (isUserA) {
                match.userAConsent = true;
            } else {
                match.userBConsent = true;
            }

            await matchRepository.save(match);

            // HUGE LOG for consent received
            console.log("\n" + "=".repeat(80));
            console.log("🎉🎉🎉 CONSENT RECEIVED! 🎉🎉🎉");
            console.log("=".repeat(80));
            console.log(`👤 User: ${senderId} (${isUserA ? 'User A' : 'User B'})`);
            console.log(`💬 Match ID: ${matchId}`);
            console.log(`🤝 Match Type: ${match.type}`);
            console.log(`📊 Confidence: ${Math.round(match.matchData.confidence * 100)}%`);
            console.log(`👥 User A Consent: ${match.userAConsent ? '✅ YES' : '❌ NO'}`);
            console.log(`👥 User B Consent: ${match.userBConsent ? '✅ YES' : '❌ NO'}`);
            console.log(`🔗 Both Consented: ${match.userAConsent && match.userBConsent ? '✅ YES - CREATING GROUP!' : '⏳ Waiting for other user...'}`);
            console.log("=".repeat(80) + "\n");

            // Check if both users have given consent
            if (match.userAConsent && match.userBConsent) {
                // Check if this match is already being processed to prevent duplicates
                if (this.processingMatches.has(match.id)) {
                    console.log(`⏭️ Match ${match.id} is already being processed, skipping duplicate group creation`);
                    return;
                }
                
                // Add to processing set to prevent concurrent processing
                this.processingMatches.add(match.id);
                
                try {
                    console.log("\n" + "🚀".repeat(40));
                    console.log("🎊🎊🎊 MUTUAL CONSENT ACHIEVED! 🎊🎊🎊");
                    console.log("🚀".repeat(40));
                    console.log("🔥 CREATING MUTUAL GROUP NOW! 🔥");
                    console.log("🚀".repeat(40) + "\n");
                    
                    await this.createMutualGroup(match);
                } finally {
                    // Always remove from processing set when done
                    this.processingMatches.delete(match.id);
                }
            }

        } catch (error) {
            console.error("Error processing consent response:", error);
        }
    }

    /**
     * Create a group between DreamSync platform user and the two matched users
     */
    private async createMutualGroup(match: Match): Promise<void> {
        try {
            console.log(`🔗 Creating mutual group for match: ${match.id}`);

            const dreamsyncUser = await this.findDreamSyncUser();
            if (!dreamsyncUser) {
                console.error("DreamSync user not found for group creation");
                return;
            }

            // Check if a group already exists for this activity type
            const groupName = this.generateGroupName(match);
            const existingGroup = await this.findExistingGroup(groupName, match);

            if (existingGroup) {
                console.log(`✅ Group already exists: ${existingGroup.id}`);
                await this.sendGroupCreatedMessage(existingGroup, match);
                return;
            }

            // Create new group with DreamSync platform user and both matched users
            const groupDescription = `Group created by DreamSync based on mutual consent for ${match.type} activity`;
            const charter = this.generateGroupCharter(match);

            console.log(`🔧 Creating group with name: "${groupName}"`);
            console.log(`🔧 Members: DreamSync (${dreamsyncUser.id}), UserA (${match.userAId}), UserB (${match.userBId})`);

            const mutualGroup = await this.groupService.createGroup(
                groupName,
                groupDescription,
                dreamsyncUser.id, // DreamSync platform user is the owner
                [dreamsyncUser.id], // DreamSync platform user is admin
                [dreamsyncUser.id, match.userAId, match.userBId], // All three users as members
                charter, // Charter describing the group purpose
                false, // isPrivate = false (group activity)
                "public" // visibility
            );

            console.log(`✅ Created mutual group: ${mutualGroup.id}`);

            // Wait 10 seconds to ensure the group is fully created before sending system message
            console.log(`⏳ Waiting 10 seconds for group to be fully created before sending system message...`);
            await new Promise(resolve => setTimeout(resolve, 10000));
            console.log(`✅ 10 seconds passed, now sending system message`);

            // Send system message about group creation
            await this.sendGroupCreatedMessage(mutualGroup, match);

            // Mark match as active
            const matchRepository = AppDataSource.getRepository(Match);
            match.isActive = true;
            match.status = MatchStatus.ACCEPTED;
            await matchRepository.save(match);

            // HUGE SUCCESS LOG
            console.log("\n" + "🎉".repeat(50));
            console.log("🏆🏆🏆 MUTUAL GROUP CREATED SUCCESSFULLY! 🏆🏆🏆");
            console.log("🎉".repeat(50));
            console.log(`👥 Group ID: ${mutualGroup.id}`);
            console.log(`🏷️ Group Name: ${groupName}`);
            console.log(`👥 Members: DreamSync Platform, ${match.userA.name || match.userA.ename}, ${match.userB.name || match.userB.ename}`);
            console.log(`🤝 Match ID: ${match.id}`);
            console.log(`🎯 Activity Type: ${match.type}`);
            console.log(`✅ Status: ACTIVE`);
            console.log("🎉".repeat(50) + "\n");

        } catch (error) {
            console.error("Error creating mutual group:", error);
        }
    }

    /**
     * Generate a group name based on the match activity
     */
    private generateGroupName(match: Match): string {
        const activity = this.extractActivityFromMatch(match);
        return `DreamSync ${activity} Group`;
    }

    /**
     * Extract the main activity from match data
     */
    private extractActivityFromMatch(match: Match): string {
        // Look for chess or other activities in suggested activities
        const activities = match.matchData.suggestedActivities || [];
        
        // Check for chess specifically
        if (activities.some(activity => activity.toLowerCase().includes('chess'))) {
            return 'Chess';
        }
        
        // Check for other group activities
        if (activities.some(activity => 
            activity.toLowerCase().includes('sports') || 
            activity.toLowerCase().includes('game') ||
            activity.toLowerCase().includes('tournament')
        )) {
            return 'Gaming';
        }
        
        // Default to collaboration
        return 'Collaboration';
    }

    /**
     * Find existing group for this activity type
     */
    private async findExistingGroup(groupName: string, match: Match): Promise<Group | null> {
        try {
            console.log(`🔍 Looking for existing group: "${groupName}"`);
            
            // Look for groups with similar names and check if they contain the same users
            const groups = await this.groupService.groupRepository.find({
                where: {
                    name: groupName,
                },
                relations: ["members"]
            });

            console.log(`🔍 Found ${groups.length} groups with name "${groupName}"`);

            // Check if any of these groups already contain both matched users
            for (const group of groups) {
                const memberIds = group.members.map(member => member.id);
                const hasUserA = memberIds.includes(match.userAId);
                const hasUserB = memberIds.includes(match.userBId);
                
                console.log(`🔍 Group ${group.id} members:`, memberIds);
                console.log(`🔍 Has User A (${match.userAId}): ${hasUserA}`);
                console.log(`🔍 Has User B (${match.userBId}): ${hasUserB}`);
                
                if (hasUserA && hasUserB) {
                    console.log(`✅ Found existing group ${group.id} with both users`);
                    return group;
                }
            }

            console.log(`❌ No existing group found with both users`);
            return null;
        } catch (error) {
            console.error("Error finding existing group:", error);
            return null;
        }
    }

    /**
     * Generate a charter for the group
     */
    private generateGroupCharter(match: Match): string {
        const activity = this.extractActivityFromMatch(match);
        const suggestedActivities = match.matchData.suggestedActivities?.join(", ") || "collaboration";
        
        return `# DreamSync ${activity} Group

## Purpose
This group was created by DreamSync based on mutual consent between ${match.userA.name || match.userA.ename} and ${match.userB.name || match.userB.ename}.

## Suggested Activities
${suggestedActivities}

## Group Rules
- Be respectful and inclusive
- Welcome new members who share similar interests
- Use this space for ${activity.toLowerCase()} related discussions and activities

## Match Details
- Match ID: ${match.id}
- Confidence: ${Math.round(match.matchData.confidence * 100)}%
- Created: ${new Date().toISOString()}

This group can grow as more people with similar interests join!`;
    }

    /**
     * Send a system message about the group being created
     */
    private async sendGroupCreatedMessage(group: Group, match: Match): Promise<void> {
        try {
            const dreamsyncUser = await this.findDreamSyncUser();
            if (!dreamsyncUser) {
                console.error("DreamSync user not found for chat creation message");
                return;
            }

            const messageRepository = AppDataSource.getRepository(Message);
            const activity = this.extractActivityFromMatch(match);
            const messageContent = `$$system-message$$

🎉 Great news! Both you and ${match.userAId === group.members[0]?.id ? match.userB.name || match.userB.ename : match.userA.name || match.userA.ename} have agreed to connect.

This ${activity} group has been created by DreamSync based on your mutual consent! You can now start collaborating on your shared interests with other group members.

Suggested activities: ${match.matchData.suggestedActivities?.join(", ") || "Connect and explore together"}

This group can grow as more people with similar interests join. Welcome to the DreamSync ${activity} community!

Best regards,
DreamSync

[Group Created for Match ID: ${match.id}]`;

            const message = messageRepository.create({
                text: messageContent,
                sender: dreamsyncUser,
                group: group,
                isSystemMessage: true,
            });

            await messageRepository.save(message);
            console.log(`✅ Group creation message sent to group: ${group.id}`);
            console.log(`📝 Message content preview: "${messageContent.substring(0, 100)}..."`);
            console.log(`👥 Group members: ${group.members?.map(m => m.name || m.ename).join(', ') || 'No members loaded'}`);

        } catch (error) {
            console.error("Error sending group creation message:", error);
        }
    }

    /**
     * Find the DreamSync platform user
     */
    private async findDreamSyncUser(): Promise<User | null> {
        try {
            const users = await this.userService.searchUsers("DreamSync Platform");
            return users.find(user => 
                user.name?.includes("DreamSync Platform")
            ) || null;
        } catch (error) {
            console.error("Error finding DreamSync user:", error);
            return null;
        }
    }
}
