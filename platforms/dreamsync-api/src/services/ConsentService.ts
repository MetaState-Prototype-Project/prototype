import { AppDataSource } from "../database/data-source";
import { Match, MatchStatus } from "../database/entities/Match";
import { User } from "../database/entities/User";
import { Group } from "../database/entities/Group";
import { Message } from "../database/entities/Message";
import { UserService } from "./UserService";
import { GroupService } from "./GroupService";
import { withOperationContext } from "../context/OperationContext";

export class ConsentService {
    private userService: UserService;
    private groupService: GroupService;
    private processingMatches: Set<string> = new Set(); // Track matches being processed

    constructor() {
        this.userService = new UserService();
        this.groupService = new GroupService();
    }

    /**
     * Process a consent response to a match notification (by Match ID)
     */
    async processConsentResponse(messageText: string, senderId: string, groupId: string): Promise<void> {
        // Generate unique operation ID for this consent processing
        const operationId = `consent-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        
        return withOperationContext('ConsentService', operationId, async () => {
            try {
            // Check if the message text itself is a UUID (Match ID)
            const uuidRegex = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
            const isDirectMatchId = uuidRegex.test(messageText.trim());
            
            let matchId: string;
            
            if (isDirectMatchId) {
                // Message text is directly the Match ID
                matchId = messageText.trim();
                console.log("✅ Direct Match ID provided:", matchId);
            } else {
                // First, find the most recent system message with a Match ID
                const group = await this.groupService.getGroupById(groupId);
                if (!group) {
                    console.error("Group not found:", groupId);
                    return;
                }

                // Find the MOST RECENT system message with match ID in this group
                const messageRepository = AppDataSource.getRepository(Message);
                const systemMessage = await messageRepository
                    .createQueryBuilder("message")
                    .leftJoinAndSelect("message.sender", "sender")
                    .where("message.group.id = :groupId", { groupId })
                    .andWhere("message.isSystemMessage = :isSystem", { isSystem: true })
                    .andWhere("message.text ILIKE :pattern", { pattern: "%[Match ID:%" })
                    .orderBy("message.createdAt", "DESC") // ✅ Get the most recent one
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

                matchId = matchIdMatch[1];
                console.log("📋 Found system message:", systemMessage.text.substring(0, 100) + "...");
                console.log("📅 Message created at:", systemMessage.createdAt);

                // Check if the message text contains the match ID (consent response)
                const isConsentResponse = messageText.toLowerCase().includes(matchId.toLowerCase());
                
                if (!isConsentResponse) {
                    console.log("Message does not contain match ID, not a consent response");
                    return;
                }
            }

            console.log("Processing consent for match:", matchId);
            console.log("✅ Valid consent response detected for match:", matchId);

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

        // Handle join existing group matches differently
        if (match.matchData?.isJoinExistingGroup && match.matchData?.existingGroupId) {
            await this.processJoinExistingGroupConsent(match, senderId, matchId);
            return;
        }

            // Handle multi-user matches differently
            if (match.matchData?.isMultiUserMatch && match.matchData?.allUserIds) {
                await this.processMultiUserConsent(match, senderId, matchId);
                return;
            }

            // Handle 2-user matches (existing logic)
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

            // Send acknowledgment message to the user who gave consent
            await this.sendConsentAcknowledgment(senderId, match);

            console.log(`✅ Consent received from ${senderId} for match ${matchId}`);

            // Check if both users have given consent
            if (match.userAConsent && match.userBConsent) {
                // Check if this match is already being processed to prevent duplicates
                if (this.processingMatches.has(match.id)) {
                    console.log(`⏭️ Match ${match.id} is already being processed, skipping duplicate processing`);
                    return;
                }
                
                // Add to processing set to prevent concurrent processing
                this.processingMatches.add(match.id);
                
                try {
                    console.log("\n" + "🚀".repeat(40));
                    console.log("🎊🎊🎊 MUTUAL CONSENT ACHIEVED! 🎊🎊🎊");
                    console.log("🚀".repeat(40));
                    console.log("🔥 PROCESSING CONSENT NOW! 🔥");
                    console.log("🚀".repeat(40) + "\n");
                    
                    await this.processMutualConsent(match);
                } finally {
                    // Always remove from processing set when done
                    this.processingMatches.delete(match.id);
                }
            }

            } catch (error) {
                console.error("Error processing consent response:", error);
            }
        });
    }

    /**
     * Process mutual consent - either create new group or add to existing group
     */
    private async processMutualConsent(match: Match): Promise<void> {
        try {
            console.log(`🔄 Processing mutual consent for match: ${match.id}`);

            // Handle multi-user matches differently
            if (match.matchData?.isMultiUserMatch && match.matchData?.allUserIds) {
                await this.processMultiUserMutualConsent(match);
                return;
            }

            // Handle 2-user matches (existing logic)
            // Check if there's an existing group for this activity type
            const activity = this.extractActivityFromMatch(match);
            const existingGroup = await this.findExistingGroupForActivity(activity, match);

            if (existingGroup) {
                console.log(`🏠 Found existing group: ${existingGroup.id} for activity: ${activity}`);
                console.log(`📋 Original match participants:`, existingGroup.originalMatchParticipants);
                
                // Check if both users were part of the original match
                const isOriginalMemberA = existingGroup.originalMatchParticipants?.includes(match.userAId) || false;
                const isOriginalMemberB = existingGroup.originalMatchParticipants?.includes(match.userBId) || false;
                
                console.log(`🔍 User A (${match.userAId}) is original member: ${isOriginalMemberA}`);
                console.log(`🔍 User B (${match.userBId}) is original member: ${isOriginalMemberB}`);
                console.log(`🔍 Match scenario: A=${isOriginalMemberA}, B=${isOriginalMemberB}`);
                
                if (isOriginalMemberA && isOriginalMemberB) {
                    // Both users are original members - add both to group
                    console.log(`✅ Both users are original members, adding to existing group`);
                    await this.addOriginalMembersToExistingGroup(existingGroup, match);
                } else if (isOriginalMemberA || isOriginalMemberB) {
                    // One user is original member, one is new - need admin consent
                    console.log(`⚠️ Mixed consent: one original member, one new user - requiring admin consent`);
                    await this.handleMixedConsent(existingGroup, match, isOriginalMemberA);
                } else {
                    // Both users are new - need admin consent
                    console.log(`⚠️ Both users are new - requiring admin consent`);
                    await this.handleNewUserConsent(existingGroup, match);
                }
            } else {
                console.log(`🆕 No existing group found, creating new group for activity: ${activity}`);
                await this.createMutualGroup(match);
            }

        } catch (error) {
            console.error("Error processing mutual consent:", error);
        }
    }

    /**
     * Process mutual consent for multi-user matches
     */
    private async processMultiUserMutualConsent(match: Match): Promise<void> {
        try {
            console.log(`🔄 Processing multi-user mutual consent for match: ${match.id}`);
            
            // Check if this is a "join existing group" match
            if (match.matchData?.isJoinExistingGroup && match.matchData?.existingGroupId) {
                // This should not happen for multi-user matches anymore since we create 2-user matches for join existing group
                console.log("⚠️ Multi-user match with join existing group - this should not happen");
                return;
            }
            
            const allUserIds = match.matchData?.allUserIds || [];
            const userConsents = match.matchData?.userConsents || {};
            const consentThreshold = match.matchData?.consentThreshold || 2;
            
            // Get users who have consented
            const consentedUserIds = allUserIds.filter(userId => userConsents[userId]);
            
            console.log(`👥 Total users: ${allUserIds.length}`);
            console.log(`✅ Consented users: ${consentedUserIds.length} (${consentedUserIds.join(', ')})`);
            console.log(`🎯 Consent threshold: ${consentThreshold}`);
            
            // Check if there's an existing group for this activity type
            const activity = this.extractActivityFromMatch(match);
            const existingGroup = await this.findExistingGroupForActivity(activity, match);
            
            if (existingGroup) {
                console.log(`🏠 Found existing group: ${existingGroup.id} for activity: ${activity}`);
                
                // For multi-user matches with existing groups, we need to handle this more carefully
                // For now, let's add all consented users to the existing group
                await this.addMultiUserMembersToExistingGroup(existingGroup, match, consentedUserIds);
            } else {
                console.log(`🆕 No existing group found, creating new multi-user group for activity: ${activity}`);
                await this.createMultiUserGroup(match, consentedUserIds);
            }
            
        } catch (error) {
            console.error("Error processing multi-user mutual consent:", error);
        }
    }


    /**
     * Add multiple users to an existing group
     */
    private async addMultiUserMembersToExistingGroup(existingGroup: Group, match: Match, consentedUserIds: string[]): Promise<void> {
        try {
            console.log(`👥 Adding ${consentedUserIds.length} users to existing group: ${existingGroup.id}`);
            
            const dreamsyncUser = await this.findDreamSyncUser();
            if (!dreamsyncUser) {
                console.error("DreamSync user not found for multi-user group addition");
                return;
            }

            // Add all consented users to the group
            await this.groupService.addMembers(existingGroup.id, consentedUserIds);
            
            // Send notifications to all users
            for (const userId of consentedUserIds) {
                await this.sendGroupJoinNotification(userId, existingGroup, match);
            }
            
            // Mark match as active
            const matchRepository = AppDataSource.getRepository(Match);
            match.isActive = true;
            match.status = MatchStatus.ACCEPTED;
            await matchRepository.save(match);
            
            console.log(`✅ Successfully added ${consentedUserIds.length} users to existing group: ${existingGroup.id}`);
            
        } catch (error) {
            console.error("Error adding multi-user members to existing group:", error);
        }
    }

    /**
     * Create a new group for multi-user match
     */
    private async createMultiUserGroup(match: Match, consentedUserIds: string[]): Promise<void> {
        try {
            console.log(`🆕 Creating new multi-user group for ${consentedUserIds.length} users`);
            
            const dreamsyncUser = await this.findDreamSyncUser();
            if (!dreamsyncUser) {
                console.error("DreamSync user not found for multi-user group creation");
                return;
            }

            const activity = this.extractActivityFromMatch(match);
            const groupName = this.generateGroupName(match);
            const groupDescription = `Match ID: ${match.id}`; // Use Match ID as description for deduplication
            
            // Randomly select an admin from consented users
            const randomAdminId = consentedUserIds[Math.floor(Math.random() * consentedUserIds.length)];
            
            // Create group with all consented users + DreamSync user
            const allMemberIds = [dreamsyncUser.id, ...consentedUserIds];
            
            const mutualGroup = await this.groupService.createGroup(
                groupName,
                groupDescription,
                randomAdminId, // Random user is the owner/admin
                [randomAdminId], // Random user is admin
                allMemberIds, // All users as members
                undefined, // NO CHARTER - let users create their own
                false, // isPrivate = false (group activity)
                "public", // visibility
                undefined, // avatarUrl
                undefined, // bannerUrl
                consentedUserIds // Store original match participants
            );
            
            console.log(`✅ Created multi-user group: ${mutualGroup.id}`);
            console.log(`👥 Group members: ${allMemberIds.join(', ')}`);
            console.log(`👑 Admin: ${randomAdminId}`);

            // Send admin announcement to the group after 10 seconds
            setTimeout(async () => {
                try {
                    const adminUser = await this.userService.getUserById(randomAdminId);
                    if (adminUser) {
                        await this.sendGroupAdminAnnouncement(mutualGroup, adminUser);
                        console.log(`📢 Sent admin announcement to multi-user group: ${mutualGroup.id} (after 10s delay)`);
                    }
                } catch (error) {
                    console.error("Error sending delayed admin announcement to multi-user group:", error);
                }
            }, 10_000); // 10 second delay
            
            console.log(`⏰ Scheduled admin announcement for multi-user group: ${mutualGroup.id} (in 10 seconds)`);

            // Mark match as active
            const matchRepository = AppDataSource.getRepository(Match);
            match.isActive = true;
            match.status = MatchStatus.ACCEPTED;
            await matchRepository.save(match);
            
            // Send notifications to all users
            for (const userId of consentedUserIds) {
                await this.sendGroupCreatedNotification(userId, mutualGroup, match);
            }
            
        } catch (error) {
            console.error("Error creating multi-user group:", error);
        }
    }

    /**
     * Add a new member to an existing group (admin + new member consent)
     */
    private async addMemberToExistingGroup(existingGroup: Group, match: Match): Promise<void> {
        try {
            console.log(`👥 Adding member to existing group: ${existingGroup.id}`);

            const dreamsyncUser = await this.findDreamSyncUser();
            if (!dreamsyncUser) {
                console.error("DreamSync user not found for group member addition");
                return;
            }

            // Find the admin of the existing group
            const adminId = existingGroup.owner;
            const adminUser = existingGroup.members?.find(m => m.id === adminId);

            if (!adminUser) {
                console.error("Admin not found for existing group:", existingGroup.id);
                return;
            }

            // Determine which user is the new member (not the admin)
            const newMemberId = match.userAId === adminId ? match.userBId : match.userAId;
            const newMember = match.userAId === adminId ? match.userB : match.userA;

            console.log(`👑 Admin: ${adminUser.name || adminUser.ename} (${adminId})`);
            console.log(`👤 New Member: ${newMember.name || newMember.ename} (${newMemberId})`);

            // Add the new member to the existing group
            const updatedMembers = [...(existingGroup.members?.map(m => m.id) || []), newMemberId];
            
            // Update the group with the new member
            existingGroup.members = updatedMembers.map(id => ({ id } as User));
            await this.groupService.groupRepository.save(existingGroup);

            console.log(`✅ Added ${newMember.name || newMember.ename} to existing group: ${existingGroup.id}`);

            // Send privacy-preserving notifications
            await this.sendGroupJoinNotifications(existingGroup, adminUser, newMember, match);

            // Mark match as active
            const matchRepository = AppDataSource.getRepository(Match);
            match.isActive = true;
            match.status = MatchStatus.ACCEPTED;
            await matchRepository.save(match);

            console.log(`✅ Member ${newMember.name || newMember.ename} added to group ${existingGroup.name}`);

        } catch (error) {
            console.error("Error adding member to existing group:", error);
        }
    }

    /**
     * Add original members to existing group (no admin consent needed)
     */
    private async addOriginalMembersToExistingGroup(existingGroup: Group, match: Match): Promise<void> {
        try {
            console.log(`👥 Adding original members to existing group: ${existingGroup.id}`);

            const dreamsyncUser = await this.findDreamSyncUser();
            if (!dreamsyncUser) {
                console.error("DreamSync user not found for group member addition");
                return;
            }

            // Add both users to the existing group
            const currentMemberIds = existingGroup.members?.map(m => m.id) || [];
            const newMemberIds = [match.userAId, match.userBId];
            const updatedMembers = [...currentMemberIds, ...newMemberIds.filter(id => !currentMemberIds.includes(id))];
            
            // Update the group with the new members
            existingGroup.members = updatedMembers.map(id => ({ id } as User));
            await this.groupService.groupRepository.save(existingGroup);

            console.log(`✅ Added original members ${match.userA.name || match.userA.ename} and ${match.userB.name || match.userB.ename} to existing group: ${existingGroup.id}`);

            // Send notifications to both users
            await this.sendOriginalMemberNotifications(existingGroup, match);

            // Mark match as active
            const matchRepository = AppDataSource.getRepository(Match);
            match.isActive = true;
            match.status = MatchStatus.ACCEPTED;
            await matchRepository.save(match);

            console.log(`✅ Original members added to group ${existingGroup.name}`);

        } catch (error) {
            console.error("Error adding original members to existing group:", error);
        }
    }

    /**
     * Handle mixed consent (one original member, one new user)
     */
    private async handleMixedConsent(existingGroup: Group, match: Match, isUserAOriginal: boolean): Promise<void> {
        try {
            console.log(`⚠️ Handling mixed consent for group: ${existingGroup.id}`);
            
            const dreamsyncUser = await this.findDreamSyncUser();
            if (!dreamsyncUser) {
                console.error("DreamSync user not found for mixed consent handling");
                return;
            }

            const adminId = existingGroup.owner;
            const adminUser = existingGroup.members?.find(m => m.id === adminId);
            const originalMember = isUserAOriginal ? match.userA : match.userB;
            const newUser = isUserAOriginal ? match.userB : match.userA;

            if (!adminUser) {
                console.error("Admin not found for existing group:", existingGroup.id);
                return;
            }

            console.log(`👑 Admin: ${adminUser.name || adminUser.ename} (${adminId})`);
            console.log(`👤 Original Member: ${originalMember.name || originalMember.ename} (${isUserAOriginal ? match.userAId : match.userBId})`);
            console.log(`🆕 New User: ${newUser.name || newUser.ename} (${isUserAOriginal ? match.userBId : match.userAId})`);

            // Send notification to admin asking for consent to add new user
            await this.sendAdminConsentRequest(existingGroup, adminUser, newUser, match);

            // Send notification to original member that they're being added
            await this.sendOriginalMemberNotification(existingGroup, originalMember, match);

            console.log(`✅ Mixed consent handled - admin consent requested for new user: ${newUser.name || newUser.ename}`);

        } catch (error) {
            console.error("Error handling mixed consent:", error);
        }
    }

    /**
     * Handle new user consent (both users are new)
     */
    private async handleNewUserConsent(existingGroup: Group, match: Match): Promise<void> {
        try {
            console.log(`⚠️ Handling new user consent for group: ${existingGroup.id}`);
            
            const dreamsyncUser = await this.findDreamSyncUser();
            if (!dreamsyncUser) {
                console.error("DreamSync user not found for new user consent handling");
                return;
            }

            const adminId = existingGroup.owner;
            const adminUser = existingGroup.members?.find(m => m.id === adminId);

            if (!adminUser) {
                console.error("Admin not found for existing group:", existingGroup.id);
                return;
            }

            console.log(`👑 Admin: ${adminUser.name || adminUser.ename} (${adminId})`);
            console.log(`🆕 New Users: ${match.userA.name || match.userA.ename}, ${match.userB.name || match.userB.ename}`);

            // Send notification to admin asking for consent to add both new users
            await this.sendAdminConsentRequestForBoth(existingGroup, adminUser, match);

            console.log(`✅ New user consent handled - admin consent requested for both users`);

        } catch (error) {
            console.error("Error handling new user consent:", error);
        }
    }

    /**
     * Send admin consent request for a single new user
     */
    private async sendAdminConsentRequest(
        group: Group, 
        adminUser: User, 
        newUser: User, 
        match: Match
    ): Promise<void> {
        try {
            const dreamsyncUser = await this.findDreamSyncUser();
            if (!dreamsyncUser) return;

            const adminChatResult = await this.findOrCreateMutualChat(adminUser.id);
            if (!adminChatResult.chat) return;
            
            const adminChat = adminChatResult.chat;
            const wasCreated = adminChatResult.wasCreated;
            
            // If chat was just created, wait 15 seconds before sending message
            if (wasCreated) {
                console.log(`⏳ Admin chat was just created, waiting 15 seconds before sending message...`);
                await new Promise(resolve => setTimeout(resolve, 15000));
                console.log(`✅ 15-second delay completed for admin message`);
            }

            const activity = this.extractActivityFromMatch(match);
            const messageContent = `$$system-message$$

👥 New user wants to join your ${activity} group!

New User: ${newUser.name || newUser.ename}
Group: ${group.name}
Activity: ${activity}
Confidence: ${Math.round(match.matchData.confidence * 100)}%

Suggested activities: ${match.matchData.suggestedActivities?.join(", ") || "Connect and explore together"}

This user was matched with an original group member. Reply with the Match ID "${match.id}" to add them to the group.

Best regards,
DreamSync

[Admin Consent Request for Match ID: ${match.id}]`;

            console.log(`💾 Creating admin consent request message...`);
            const messageRepository = AppDataSource.getRepository(Message);
            const message = messageRepository.create({
                text: messageContent,
                sender: dreamsyncUser,
                group: adminChat,
                isSystemMessage: true,
            });

            console.log(`💾 Saving admin consent request message to database...`);
            const savedMessage = await messageRepository.save(message);
            console.log(`✅ Admin consent request message saved with ID: ${savedMessage.id}`);
            console.log(`✅ Admin consent request sent to ${adminUser.name || adminUser.ename} for new user ${newUser.name || newUser.ename}`);
            console.log(`📊 Message stats: Length=${messageContent.length}, Chat=${adminChat.id}, Sender=${dreamsyncUser.id}`);
        } catch (error) {
            console.error("Error sending admin consent request:", error);
        }
    }

    /**
     * Send admin consent request for both new users
     */
    private async sendAdminConsentRequestForBoth(
        group: Group, 
        adminUser: User, 
        match: Match
    ): Promise<void> {
        try {
            console.log(`📤 SENDING ADMIN CONSENT REQUEST FOR BOTH USERS`);
            console.log(`👑 Admin: ${adminUser.name || adminUser.ename} (${adminUser.id})`);
            console.log(`🆕 New Users: ${match.userA.name || match.userA.ename}, ${match.userB.name || match.userB.ename}`);
            
            const dreamsyncUser = await this.findDreamSyncUser();
            if (!dreamsyncUser) {
                console.error("❌ DreamSync user not found for admin consent request");
                return;
            }
            console.log(`✅ DreamSync user found: ${dreamsyncUser.id}`);

            const adminChatResult = await this.findOrCreateMutualChat(adminUser.id);
            if (!adminChatResult.chat) {
                console.error("❌ Could not find/create admin chat");
                return;
            }
            
            const adminChat = adminChatResult.chat;
            const wasCreated = adminChatResult.wasCreated;
            
            // If chat was just created, wait 15 seconds before sending message
            if (wasCreated) {
                console.log(`⏳ Admin chat was just created, waiting 15 seconds before sending message...`);
                await new Promise(resolve => setTimeout(resolve, 15000));
                console.log(`✅ 15-second delay completed for admin message`);
            }
            console.log(`✅ Admin chat found/created: ${adminChat.id}`);

            const activity = this.extractActivityFromMatch(match);
            const messageContent = `$$system-message$$

👥 Two new users want to join your ${activity} group!

New Users: ${match.userA.name || match.userA.ename}, ${match.userB.name || match.userB.ename}
Group: ${group.name}
Activity: ${activity}
Confidence: ${Math.round(match.matchData.confidence * 100)}%

Suggested activities: ${match.matchData.suggestedActivities?.join(", ") || "Connect and explore together"}

These users were matched together. Reply with the Match ID "${match.id}" to add both to the group.

Best regards,
DreamSync

[Admin Consent Request for Match ID: ${match.id}]`;

            const messageRepository = AppDataSource.getRepository(Message);
            const message = messageRepository.create({
                text: messageContent,
                sender: dreamsyncUser,
                group: adminChat,
                isSystemMessage: true,
            });

            await messageRepository.save(message);
            console.log(`✅ Admin consent request sent to ${adminUser.name || adminUser.ename} for both new users`);
        } catch (error) {
            console.error("Error sending admin consent request for both:", error);
        }
    }

    /**
     * Send notification to original member that they're being added
     */
    private async sendOriginalMemberNotification(
        group: Group, 
        originalMember: User, 
        match: Match
    ): Promise<void> {
        try {
            const dreamsyncUser = await this.findDreamSyncUser();
            if (!dreamsyncUser) return;

            const memberChatResult = await this.findOrCreateMutualChat(originalMember.id);
            if (!memberChatResult.chat) return;
            
            const memberChat = memberChatResult.chat;
            const wasCreated = memberChatResult.wasCreated;
            
            // If chat was just created, wait 15 seconds before sending message
            if (wasCreated) {
                console.log(`⏳ Member chat was just created, waiting 15 seconds before sending message...`);
                await new Promise(resolve => setTimeout(resolve, 15000));
                console.log(`✅ 15-second delay completed for member message`);
            }

            const activity = this.extractActivityFromMatch(match);
            const messageContent = `$$system-message$$

Welcome back to the ${activity} group!

You were part of the original match for this group and have been automatically added. You can now connect with other members who share similar interests.

Best regards,
DreamSync

[Original Member Added for Match ID: ${match.id}]`;

            const messageRepository = AppDataSource.getRepository(Message);
            const message = messageRepository.create({
                text: messageContent,
                sender: dreamsyncUser,
                group: memberChat,
                isSystemMessage: true,
            });

            await messageRepository.save(message);
            console.log(`✅ Original member notification sent to ${originalMember.name || originalMember.ename}`);
        } catch (error) {
            console.error("Error sending original member notification:", error);
        }
    }

    /**
     * Send notifications to original members
     */
    private async sendOriginalMemberNotifications(group: Group, match: Match): Promise<void> {
        try {
            const dreamsyncUser = await this.findDreamSyncUser();
            if (!dreamsyncUser) return;

            const activity = this.extractActivityFromMatch(match);

            // Send notification to both users
            for (const user of [match.userA, match.userB]) {
                const userChatResult = await this.findOrCreateMutualChat(user.id);
                if (!userChatResult.chat) continue;
                
                const userChat = userChatResult.chat;
                const wasCreated = userChatResult.wasCreated;
                
                // If chat was just created, wait 15 seconds before sending message
                if (wasCreated) {
                    console.log(`⏳ User chat was just created, waiting 15 seconds before sending message...`);
                    await new Promise(resolve => setTimeout(resolve, 15000));
                    console.log(`✅ 15-second delay completed for user message`);
                }

                const messageContent = `$$system-message$$

Welcome to the ${activity} group!

You were part of the original match for this group and have been automatically added. You can now connect with other members who share similar interests.

Best regards,
DreamSync

[Original Members Added for Match ID: ${match.id}]`;

                const messageRepository = AppDataSource.getRepository(Message);
                const message = messageRepository.create({
                    text: messageContent,
                    sender: dreamsyncUser,
                    group: userChat,
                    isSystemMessage: true,
                });

                await messageRepository.save(message);
                console.log(`✅ Original member notification sent to ${user.name || user.ename}`);
            }
        } catch (error) {
            console.error("Error sending original member notifications:", error);
        }
    }

    /**
     * Find existing group for a specific activity type AND the same users
     * This allows users to have multiple groups for different activities
     */
    private async findExistingGroupForActivity(activity: string, match: Match): Promise<Group | null> {
        try {
            console.log(`🔍 Looking for existing group for activity: ${activity} with users: ${match.userAId}, ${match.userBId}`);
            
            // Look for groups with similar activity names AND containing both users
            const capitalizedActivity = activity.charAt(0).toUpperCase() + activity.slice(1);
            const groups = await this.groupService.groupRepository.find({
                where: {
                    name: `DreamSync ${capitalizedActivity} Group`,
                    isPrivate: false
                },
                relations: ["members"]
            });

            console.log(`🔍 Found ${groups.length} groups with activity "${activity}"`);

            // Check if any of these groups contain BOTH matched users
            for (const group of groups) {
                const memberIds = group.members?.map(member => member.id) || [];
                const hasUserA = memberIds.includes(match.userAId);
                const hasUserB = memberIds.includes(match.userBId);
                
                console.log(`🔍 Group ${group.id} members:`, memberIds);
                console.log(`🔍 Has User A (${match.userAId}): ${hasUserA}`);
                console.log(`🔍 Has User B (${match.userBId}): ${hasUserB}`);
                
                if (hasUserA && hasUserB) {
                    console.log(`✅ Found existing group ${group.id} with both users for activity: ${activity}`);
                    return group;
                }
            }

            console.log(`❌ No existing group found with both users for activity: ${activity}`);
            return null;
        } catch (error) {
            console.error("Error finding existing group for activity:", error);
            return null;
        }
    }

    /**
     * Send notifications when a member joins an existing group
     */
    private async sendGroupJoinNotifications(
        group: Group, 
        adminUser: User, 
        newMember: User, 
        match: Match
    ): Promise<void> {
        try {
            const dreamsyncUser = await this.findDreamSyncUser();
            if (!dreamsyncUser) {
                console.error("DreamSync user not found for group join notifications");
                return;
            }

            const messageRepository = AppDataSource.getRepository(Message);
            const activity = this.extractActivityFromMatch(match);

            // Send notification to admin with full details
            const adminChatResult = await this.findOrCreateMutualChat(adminUser.id);
            if (adminChatResult.chat) {
                const adminChat = adminChatResult.chat;
                const wasCreated = adminChatResult.wasCreated;
                
                // If chat was just created, wait 15 seconds before sending message
                if (wasCreated) {
                    console.log(`⏳ Admin chat was just created, waiting 15 seconds before sending message...`);
                    await new Promise(resolve => setTimeout(resolve, 15000));
                    console.log(`✅ 15-second delay completed for admin message`);
                }
                const adminMessageContent = `$$system-message$$

👥 New member joined your ${activity} group!

New Member: ${newMember.name || newMember.ename}
Group: ${group.name}
Activity: ${activity}
Confidence: ${Math.round(match.matchData.confidence * 100)}%

Suggested activities: ${match.matchData.suggestedActivities?.join(", ") || "Connect and explore together"}

As the admin, you can manage this group and help facilitate collaboration between members.

Best regards,
DreamSync

[Group Join for Match ID: ${match.id}]`;

                const adminMessage = messageRepository.create({
                    text: adminMessageContent,
                    sender: dreamsyncUser,
                    group: adminChat,
                    isSystemMessage: true,
                });

                await messageRepository.save(adminMessage);
                console.log(`✅ Admin notification sent to ${adminUser.name || adminUser.ename}`);
            }

            // Send generic notification to new member
            const memberChatResult = await this.findOrCreateMutualChat(newMember.id);
            if (memberChatResult.chat) {
                const memberChat = memberChatResult.chat;
                const wasCreated = memberChatResult.wasCreated;
                
                // If chat was just created, wait 15 seconds before sending message
                if (wasCreated) {
                    console.log(`⏳ Member chat was just created, waiting 15 seconds before sending message...`);
                    await new Promise(resolve => setTimeout(resolve, 15000));
                    console.log(`✅ 15-second delay completed for member message`);
                }
                const memberMessageContent = `$$system-message$$

Welcome to the ${activity} group!

You've been matched with a group based on your shared interests. This group focuses on ${activity.toLowerCase()} activities and collaboration.

You can now connect with other members who share similar interests and goals.

Best regards,
DreamSync

[Group Join for Match ID: ${match.id}]`;

                const memberMessage = messageRepository.create({
                    text: memberMessageContent,
                    sender: dreamsyncUser,
                    group: memberChat,
                    isSystemMessage: true,
                });

                await messageRepository.save(memberMessage);
                console.log(`✅ Generic notification sent to new member ${newMember.name || newMember.ename}`);
            }

        } catch (error) {
            console.error("Error sending group join notifications:", error);
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

            // Generate group name for new group creation
            const groupName = this.generateGroupName(match);

            // Randomly select one of the matched users as admin (not DreamSync)
            const matchedUsers = [match.userAId, match.userBId];
            const randomAdminId = matchedUsers[Math.floor(Math.random() * matchedUsers.length)];
            const adminUser = randomAdminId === match.userAId ? match.userA : match.userB;
            
            console.log(`🎲 Randomly selected admin: ${adminUser.name || adminUser.ename} (${randomAdminId})`);

            // Create new group with DreamSync platform user and both matched users
            const groupDescription = `Match ID: ${match.id}`; // Use Match ID as description for deduplication

            console.log(`🔧 Creating group with name: "${groupName}"`);
            console.log(`🔧 Members: DreamSync (${dreamsyncUser.id}), UserA (${match.userAId}), UserB (${match.userBId})`);
            console.log(`👑 Admin: ${adminUser.name || adminUser.ename} (${randomAdminId})`);

            const mutualGroup = await this.groupService.createGroup(
                groupName,
                groupDescription,
                randomAdminId, // Random user is the owner/admin
                [randomAdminId], // Random user is admin
                [dreamsyncUser.id, match.userAId, match.userBId], // All three users as members
                undefined, // NO CHARTER - let users create their own
                false, // isPrivate = false (group activity)
                "public", // visibility
                undefined, // avatarUrl
                undefined, // bannerUrl
                [match.userAId, match.userBId] // Store original match participants
            );

            console.log(`✅ Created mutual group: ${mutualGroup.id}`);
            
            // Send admin announcement to the group after 10 seconds
            setTimeout(async () => {
                try {
                    await this.sendGroupAdminAnnouncement(mutualGroup, adminUser);
                    console.log(`📢 Sent admin announcement to group: ${mutualGroup.id} (after 10s delay)`);
                } catch (error) {
                    console.error("Error sending delayed admin announcement:", error);
                }
            }, 10_000); // 10 second delay
            
            console.log(`⏰ Scheduled admin announcement for group: ${mutualGroup.id} (in 10 seconds)`);

            // Mark match as active
            const matchRepository = AppDataSource.getRepository(Match);
            match.isActive = true;
            match.status = MatchStatus.ACCEPTED;
            await matchRepository.save(match);

            console.log(`✅ Group created successfully: ${groupName} (${mutualGroup.id})`);

        } catch (error) {
            console.error("Error creating mutual group:", error);
        }
    }

    /**
     * Generate a group name based on the match activity
     */
    private generateGroupName(match: Match): string {
        const activity = this.extractActivityFromMatch(match);
        const capitalizedActivity = activity.charAt(0).toUpperCase() + activity.slice(1);
        return `DreamSync ${capitalizedActivity} Group`;
    }

    /**
     * Generate a group description based on the match activity and user count
     */
    private generateGroupDescription(match: Match, userCount: number): string {
        const activity = this.extractActivityFromMatch(match);
        const capitalizedActivity = activity.charAt(0).toUpperCase() + activity.slice(1);
        return `A group for ${userCount} users interested in ${capitalizedActivity} activities. Connect, collaborate, and share your passion for ${activity}!`;
    }

    /**
     * Extract the main activity from match data
     */
    private extractActivityFromMatch(match: Match): string {
        // First, try to get activity from matchData.activityCategory
        if (match.matchData?.activityCategory) {
            console.log(`🎯 Using activityCategory from match data: ${match.matchData.activityCategory}`);
            return match.matchData.activityCategory;
        }
        
        // Fallback to extracting from suggested activities
        const activities = match.matchData.suggestedActivities || [];
        console.log(`🔍 Extracting activity from suggested activities:`, activities);
        
        // Check for chess specifically
        if (activities.some(activity => activity.toLowerCase().includes('chess'))) {
            return 'chess';
        }
        
        // Check for football/soccer
        if (activities.some(activity => 
            activity.toLowerCase().includes('football') || 
            activity.toLowerCase().includes('soccer')
        )) {
            return 'football';
        }
        
        // Check for other sports
        if (activities.some(activity => 
            activity.toLowerCase().includes('sports') || 
            activity.toLowerCase().includes('game') ||
            activity.toLowerCase().includes('tournament')
        )) {
            return 'gaming';
        }
        
        // Default to collaboration
        return 'collaboration';
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
        
        const capitalizedActivity = activity.charAt(0).toUpperCase() + activity.slice(1);
        return `# DreamSync ${capitalizedActivity} Group

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
     * Find the DreamSync platform user
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
            
            // Find the admin (group owner)
            const adminId = group.owner;
            const adminUser = group.members?.find(m => m.id === adminId);
            
            console.log(`👑 Sending privacy-preserving messages - Admin: ${adminUser?.name || adminUser?.ename || adminId}`);

            // Send different messages based on user role
            for (const member of group.members || []) {
                let messageContent: string;
                
                if (member.id === adminId) {
                    // Admin gets full information
                    const otherUser = member.id === match.userAId ? match.userB : match.userA;
                    messageContent = `$$system-message$$

🎉 Great news! Both you and ${otherUser.name || otherUser.ename} have agreed to connect.

This ${activity} group has been created by DreamSync based on your mutual consent! You are the admin of this group and can manage it as needed.

Suggested activities: ${match.matchData.suggestedActivities?.join(", ") || "Connect and explore together"}

This group can grow as more people with similar interests join. Welcome to the DreamSync ${activity} community!

Best regards,
DreamSync

[Group Created for Match ID: ${match.id}]`;
                } else if (member.id === dreamsyncUser.id) {
                    // DreamSync user gets admin notification
                    messageContent = `$$system-message$$

Group "${group.name}" has been successfully created!

Admin: ${adminUser?.name || adminUser?.ename || 'Unknown'}
Activity: ${activity}
Members: ${group.members?.length || 0}

The group is now active and ready for collaboration.

Best regards,
DreamSync

[Group Created for Match ID: ${match.id}]`;
                } else {
                    // Regular members get generic message (privacy-preserving)
                    messageContent = `$$system-message$$

Welcome to the ${activity} group!

A new group has been created based on shared interests. You can now collaborate with other members on activities you're both interested in.

This group can grow as more people with similar interests join. Welcome to the DreamSync ${activity} community!

Best regards,
DreamSync

[Group Created for Match ID: ${match.id}]`;
                }

                const message = messageRepository.create({
                    text: messageContent,
                    sender: dreamsyncUser,
                    group: group,
                    isSystemMessage: true,
                });

                await messageRepository.save(message);
                console.log(`✅ Privacy-preserving message sent to ${member.name || member.ename} (${member.id === adminId ? 'ADMIN' : 'MEMBER'})`);
            }

            console.log(`✅ All group creation messages sent to group: ${group.id}`);
            console.log(`👥 Group members: ${group.members?.map(m => m.name || m.ename).join(', ') || 'No members loaded'}`);

        } catch (error) {
            console.error("Error sending group creation message:", error);
        }
    }

    /**
     * Send notification to user about joining an existing group
     */
    private async sendGroupJoinNotification(userId: string, group: Group, match: Match): Promise<void> {
        try {
            console.log(`📤 Sending group join notification to user: ${userId}`);
            
            const dreamsyncUser = await this.findDreamSyncUser();
            if (!dreamsyncUser) {
                console.error("DreamSync user not found for group join notification");
                return;
            }

            const userChatResult = await this.findOrCreateMutualChat(userId);
            if (!userChatResult.chat) {
                console.error("Could not find/create user chat for group join notification");
                return;
            }
            
            const userChat = userChatResult.chat;
            const wasCreated = userChatResult.wasCreated;
            
            // If chat was just created, wait 15 seconds before sending message
            if (wasCreated) {
                console.log(`⏳ User chat was just created, waiting 15 seconds before sending message...`);
                await new Promise(resolve => setTimeout(resolve, 15000));
                console.log(`✅ 15-second delay completed for user message`);
            }

            const activity = this.extractActivityFromMatch(match);
            const messageContent = `$$system-message$$

🎉 Welcome to the ${group.name}!

You've successfully joined the ${activity} group based on your consent. You can now connect with other members and participate in group activities.

Best regards,
DreamSync Team

[Group Joined: ${group.id}]`;

            const messageRepository = AppDataSource.getRepository(Message);
            const message = messageRepository.create({
                text: messageContent,
                sender: dreamsyncUser,
                group: userChat,
                isSystemMessage: true,
            });

            await messageRepository.save(message);
            console.log(`✅ Group join notification sent to user: ${userId}`);
        } catch (error) {
            console.error("Error sending group join notification:", error);
        }
    }

    /**
     * Send notification to user about group creation
     */
    private async sendGroupCreatedNotification(userId: string, group: Group, match: Match): Promise<void> {
        try {
            console.log(`📤 Sending group created notification to user: ${userId}`);
            
            const dreamsyncUser = await this.findDreamSyncUser();
            if (!dreamsyncUser) {
                console.error("DreamSync user not found for group created notification");
                return;
            }

            const userChatResult = await this.findOrCreateMutualChat(userId);
            if (!userChatResult.chat) {
                console.error("Could not find/create user chat for group created notification");
                return;
            }
            
            const userChat = userChatResult.chat;
            const wasCreated = userChatResult.wasCreated;
            
            // If chat was just created, wait 15 seconds before sending message
            if (wasCreated) {
                console.log(`⏳ User chat was just created, waiting 15 seconds before sending message...`);
                await new Promise(resolve => setTimeout(resolve, 15000));
                console.log(`✅ 15-second delay completed for user message`);
            }

            const activity = this.extractActivityFromMatch(match);
            const messageContent = `$$system-message$$

🎉 Great news! The ${group.name} has been created!

Based on mutual consent from ${match.matchData?.allUserIds?.length || 2} users, we've created this group for ${activity} activities. You can now connect with other members and start collaborating!

Best regards,
DreamSync Team

[Group Created: ${group.id}]`;

            const messageRepository = AppDataSource.getRepository(Message);
            const message = messageRepository.create({
                text: messageContent,
                sender: dreamsyncUser,
                group: userChat,
                isSystemMessage: true,
            });

            await messageRepository.save(message);
            console.log(`✅ Group created notification sent to user: ${userId}`);
        } catch (error) {
            console.error("Error sending group created notification:", error);
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

    /**
     * Find or create a mutual chat between DreamSync and a user
     * Returns both the chat and whether it was just created
     */
    private async findOrCreateMutualChat(userId: string): Promise<{ chat: Group | null; wasCreated: boolean }> {
        try {
            console.log(`🔍 ConsentService: Looking for mutual chat between DreamSync and user: ${userId}`);
            
            const dreamsyncUser = await this.findDreamSyncUser();
            if (!dreamsyncUser) {
                console.error("❌ ConsentService: DreamSync user not found for mutual chat creation");
                return { chat: null, wasCreated: false };
            }

            console.log(`👤 ConsentService: DreamSync user found: ${dreamsyncUser.id} (${dreamsyncUser.name || dreamsyncUser.ename})`);

            // Look for existing mutual chat
            console.log(`🔍 ConsentService: Checking for existing mutual chat between DreamSync (${dreamsyncUser.id}) and user (${userId})`);
            
            // Find groups where both users are members
            const existingChat = await this.groupService.groupRepository
                .createQueryBuilder("group")
                .leftJoinAndSelect("group.members", "members")
                .where("group.isPrivate = :isPrivate", { isPrivate: true })
                .andWhere((qb) => {
                    const subQuery = qb.subQuery()
                        .select("gm.group_id")
                        .from("group_members", "gm")
                        .where("gm.user_id IN (:...memberIds)", { 
                            memberIds: [dreamsyncUser.id, userId] 
                        })
                        .groupBy("gm.group_id")
                        .having("COUNT(DISTINCT gm.user_id) = :memberCount", { memberCount: 2 })
                        .getQuery();
                    return "group.id IN " + subQuery;
                })
                .getOne();

            if (existingChat) {
                console.log(`✅ ConsentService: Found existing mutual chat: ${existingChat.id}`);
                console.log(`📋 ConsentService: Chat details: Name="${existingChat.name}", Private=${existingChat.isPrivate}, Members=${existingChat.members?.length || 0}`);
                return { chat: existingChat, wasCreated: false };
            }

            console.log(`🆕 ConsentService: No existing mutual chat found, creating new one...`);

            // Create new mutual chat
            console.log(`🔧 ConsentService: Creating mutual chat with:`);
            console.log(`   - Name: DreamSync Chat with ${userId}`);
            console.log(`   - Description: DM ID: ${userId}::${dreamsyncUser.id}`);
            console.log(`   - Owner: ${dreamsyncUser.id}`);
            console.log(`   - Members: [${dreamsyncUser.id}, ${userId}]`);
            console.log(`   - Private: true`);
            
            const mutualChat = await this.groupService.createGroup(
                `DreamSync Chat with ${userId}`,
                `DM ID: ${userId}::${dreamsyncUser.id}`,
                dreamsyncUser.id,
                [dreamsyncUser.id],
                [dreamsyncUser.id, userId],
                undefined,
                true, // isPrivate = true
                "private",
                undefined,
                undefined,
                []
            );

            console.log(`✅ ConsentService: Created new mutual chat: ${mutualChat.id}`);
            console.log(`📋 ConsentService: New chat details: Name="${mutualChat.name}", Private=${mutualChat.isPrivate}, Members=${mutualChat.members?.length || 0}`);
            return { chat: mutualChat, wasCreated: true };

        } catch (error) {
            console.error("❌ ConsentService: Error finding or creating mutual chat:", error);
            console.error("❌ ConsentService: Error details:", (error as Error).message);
            return { chat: null, wasCreated: false };
        }
    }

    /**
     * Process consent for multi-user matches
     */
    private async processMultiUserConsent(match: Match, senderId: string, matchId: string): Promise<void> {
        const matchRepository = AppDataSource.getRepository(Match);
        const allUserIds = match.matchData?.allUserIds || [];
        const userConsents = match.matchData?.userConsents || {};
        const consentThreshold = match.matchData?.consentThreshold || 2;

        // Check if sender is part of this match
        if (!allUserIds.includes(senderId)) {
            console.error("Sender is not part of this multi-user match:", senderId);
            return;
        }

        // Update consent for this user
        userConsents[senderId] = true;
        match.matchData.userConsents = userConsents;

        await matchRepository.save(match);

        // Send acknowledgment message to the user who gave consent
        await this.sendConsentAcknowledgment(senderId, match);

        // Count current consents
        const consentCount = Object.values(userConsents).filter(Boolean).length;
        const totalUsers = allUserIds.length;

        console.log(`✅ Multi-user consent received from ${senderId} (${consentCount}/${totalUsers})`);

        // Check if we've reached the consent threshold
        if (consentCount >= consentThreshold) {
            // Check if this match is already being processed to prevent duplicates
            if (this.processingMatches.has(match.id)) {
                console.log(`⏭️ Multi-user match ${match.id} is already being processed, skipping duplicate processing`);
                return;
            }

            this.processingMatches.add(match.id);
            console.log(`🚀 Processing multi-user match with ${consentCount} consents (threshold: ${consentThreshold})`);

            try {
                await this.processMutualConsent(match);
            } finally {
                this.processingMatches.delete(match.id);
            }
        }
    }

    /**
     * Send acknowledgment message to user who gave consent
     */
    private async sendConsentAcknowledgment(userId: string, match: Match): Promise<void> {
        try {
            console.log(`📤 Sending consent acknowledgment to user: ${userId}`);
            
            const dreamsyncUser = await this.findDreamSyncUser();
            if (!dreamsyncUser) {
                console.error("❌ DreamSync user not found for consent acknowledgment");
                return;
            }

            const userChatResult = await this.findOrCreateMutualChat(userId);
            if (!userChatResult.chat) {
                console.error("❌ Could not find/create user chat for acknowledgment");
                return;
            }
            
            const userChat = userChatResult.chat;
            const wasCreated = userChatResult.wasCreated;
            
            // If chat was just created, wait 15 seconds before sending message
            if (wasCreated) {
                console.log(`⏳ User chat was just created, waiting 15 seconds before sending message...`);
                await new Promise(resolve => setTimeout(resolve, 15000));
                console.log(`✅ 15-second delay completed for user message`);
            }

            const activity = this.extractActivityFromMatch(match);
            const messageContent = `$$system-message$$

✅ Consent received!

Thank you for agreeing to connect for ${activity} activities. 

We're now processing your consent and will notify you once the connection is established.

Best regards,
DreamSync Team

[Consent Acknowledged for Match ID: ${match.id}]`;

            const messageRepository = AppDataSource.getRepository(Message);
            const message = messageRepository.create({
                text: messageContent,
                sender: dreamsyncUser,
                group: userChat,
                isSystemMessage: true,
            });

            await messageRepository.save(message);
            console.log(`✅ Consent acknowledgment sent to user: ${userId}`);
        } catch (error) {
            console.error("Error sending consent acknowledgment:", error);
        }
    }

    /**
     * Send a message to the group announcing who the admin is
     */
    private async sendGroupAdminAnnouncement(group: Group, adminUser: User): Promise<void> {
        try {
            console.log(`📢 Sending admin announcement to group: ${group.id}`);
            
            const dreamsyncUser = await this.findDreamSyncUser();
            if (!dreamsyncUser) {
                console.error("❌ DreamSync user not found for admin announcement");
                return;
            }

            // Generate unique operation ID for this admin announcement
            const operationId = `admin-announcement-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            
            await withOperationContext('ConsentService', operationId, async () => {
                const messageContent = `$$system-message$$

🎉 Welcome to ${group.name}!

This group has been created based on your mutual consent. 

👑 **${adminUser.name || adminUser.ename}** has been randomly selected as the group admin and can help organize activities and manage the group.

Feel free to introduce yourselves and start planning your first activity together!

Best regards,
DreamSync Team`;

                const messageRepository = AppDataSource.getRepository(Message);
                const message = messageRepository.create({
                    text: messageContent,
                    sender: dreamsyncUser,
                    group: group,
                    isSystemMessage: true
                });

                await messageRepository.save(message);
                console.log(`✅ Sent admin announcement message to group: ${group.id}`);
            });
            
        } catch (error) {
            console.error("Error sending group admin announcement:", error);
        }
    }
    
    /**
     * Process consent for join existing group matches (2-user matches)
     */
    private async processJoinExistingGroupConsent(match: Match, senderId: string, matchId: string): Promise<void> {
        try {
            const newUserId = match.matchData?.newUserId;
            const adminUserId = match.matchData?.adminUserId;
            const groupId = match.matchData?.existingGroupId;
            
            if (!newUserId || !adminUserId || !groupId) {
                console.error("Missing required data for join existing group consent:", { newUserId, adminUserId, groupId });
                return;
            }
            
            const isNewUser = senderId === newUserId;
            const isAdmin = senderId === adminUserId;
            
            if (!isNewUser && !isAdmin) {
                console.error("Sender is not part of this join existing group match:", senderId);
                return;
            }
            
            // Update consent
            if (isNewUser) {
                match.userAConsent = true;
            } else {
                match.userBConsent = true;
            }
            
            const matchRepository = AppDataSource.getRepository(Match);
            await matchRepository.save(match);
            
            // Send acknowledgment message to the user who gave consent
            await this.sendConsentAcknowledgment(senderId, match);
            
            // Check if both users have given consent
            if (match.userAConsent && match.userBConsent) {
                // Check if this match is already being processed to prevent duplicates
                if (this.processingMatches.has(match.id)) {
                    return;
                }
                
                this.processingMatches.add(match.id);
                
                try {
                    await this.addUserToExistingGroup(match, newUserId, groupId);
                } catch (error) {
                    console.error("Error in addUserToExistingGroup:", error);
                } finally {
                    this.processingMatches.delete(match.id);
                }
            }
            
        } catch (error) {
            console.error("Error processing join existing group consent:", error);
        }
    }
    
    /**
     * Add user to existing group after both consents
     */
    private async addUserToExistingGroup(match: Match, newUserId: string, groupId: string): Promise<void> {
        try {
            // Add user to group
            const updatedGroup = await this.groupService.addMembers(groupId, [newUserId]);
            
            // Send system message to group
            await this.sendUserJoinedGroupMessage(groupId, newUserId, match);
            
            // Mark match as active
            match.isActive = true;
            match.status = MatchStatus.ACCEPTED;
            const matchRepository = AppDataSource.getRepository(Match);
            await matchRepository.save(match);
            
        } catch (error) {
            console.error("Error adding user to existing group:", error);
        }
    }
    
    /**
     * Send a message to the group when a new user joins
     */
    private async sendUserJoinedGroupMessage(groupId: string, newUserId: string, match: Match): Promise<void> {
        try {
            console.log(`📢 Sending user joined message to group: ${groupId}`);
            
            const dreamsyncUser = await this.findDreamSyncUser();
            if (!dreamsyncUser) {
                console.error("❌ DreamSync user not found for user joined message");
                return;
            }

            const newUser = await this.userService.getUserById(newUserId);
            if (!newUser) {
                console.error(`❌ New user not found: ${newUserId}`);
                return;
            }

            const group = await this.groupService.getGroupById(groupId);
            if (!group) {
                console.error(`❌ Group not found: ${groupId}`);
                return;
            }

            const activity = this.extractActivityFromMatch(match);
            const messageContent = `$$system-message$$

🎉 Welcome to ${group.name}!

**${newUser.name || newUser.ename}** has joined the group based on mutual consent for ${activity} activities.

Feel free to introduce yourselves and start planning your first activity together!

Best regards,
DreamSync Team`;

            const messageRepository = AppDataSource.getRepository(Message);
            const message = messageRepository.create({
                text: messageContent,
                sender: dreamsyncUser,
                group: group,
                isSystemMessage: true
            });

            await messageRepository.save(message);
            console.log(`✅ Sent user joined message to group: ${groupId}`);
            
        } catch (error) {
            console.error("Error sending user joined group message:", error);
        }
    }
}
