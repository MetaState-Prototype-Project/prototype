import { AppDataSource } from "../database/data-source";
import { User } from "../database/entities/User";
import { Group } from "../database/entities/Group";
import { Message } from "../database/entities/Message";
import { Match } from "../database/entities/Match";
import { UserService } from "./UserService";
import { GroupService } from "./GroupService";
import { withOperationContext } from "../context/OperationContext";
import OpenAI from "openai";

export class MatchNotificationService {
    private userService: UserService;
    private groupService: GroupService;
    private openai: OpenAI;
    private dreamsyncUser: User | null = null;

    constructor() {
        this.userService = new UserService();
        this.groupService = new GroupService();
        this.openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY,
        });
    }

    /**
     * Find the DreamSync platform user by searching for "DreamSync Platform" in their name
     */
    public async findDreamSyncUser(): Promise<User | null> {
        if (this.dreamsyncUser) {
            return this.dreamsyncUser;
        }

        try {
            // Search for users with "DreamSync Platform" in their name
            const users = await this.userService.searchUsers("DreamSync Platform");
            this.dreamsyncUser = users.find(user => 
                user.name?.includes("DreamSync Platform")
            ) || null;

            if (!this.dreamsyncUser) {
                console.error("❌ DreamSync platform user not found in database");
            } else {
                console.log(`✅ Found DreamSync platform user: ${this.dreamsyncUser.id}`);
            }

            return this.dreamsyncUser;
        } catch (error) {
            console.error("Error finding DreamSync user:", error);
            return null;
        }
    }

    /**
     * Find or create a mutual chat between DreamSync user and another user
     * Returns both the chat and whether it was just created
     */
    async findOrCreateMutualChat(targetUserId: string): Promise<{ chat: Group | null; wasCreated: boolean }> {
        console.log(`🔍 Looking for mutual chat between DreamSync and user: ${targetUserId}`);
        
        const dreamsyncUser = await this.findDreamSyncUser();
        if (!dreamsyncUser) {
            console.error("❌ Cannot create mutual chat: DreamSync user not found");
            return { chat: null, wasCreated: false };
        }

        console.log(`👤 DreamSync user found: ${dreamsyncUser.id} (${dreamsyncUser.name || dreamsyncUser.ename})`);

        // Generate unique operation ID for this chat creation
        const operationId = `mutual-chat-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        
        return withOperationContext('MatchNotificationService', operationId, async () => {
            try {
                // Check if a mutual chat already exists between these two users
                console.log(`🔍 Checking for existing mutual chat between DreamSync (${dreamsyncUser.id}) and user (${targetUserId})`);
                
                const existingChat = await this.groupService.findGroupByMembers([
                    dreamsyncUser.id,
                    targetUserId
                ]);

                if (existingChat) {
                    console.log(`✅ Found existing mutual chat: ${existingChat.id}`);
                    console.log(`📋 Chat details: Name="${existingChat.name}", Private=${existingChat.isPrivate}, Members=${existingChat.members?.length || 0}`);
                    return { chat: existingChat, wasCreated: false };
                }

                console.log(`🆕 No existing mutual chat found, creating new one...`);

                // Create a new mutual chat
                const chatName = `DreamSync Chat with ${targetUserId}`;
                const chatDescription = `DM ID: ${targetUserId}::${dreamsyncUser.id}`;
                
                console.log(`🔧 Creating mutual chat with:`);
                console.log(`   - Name: ${chatName}`);
                console.log(`   - Description: ${chatDescription}`);
                console.log(`   - Owner: ${dreamsyncUser.id}`);
                console.log(`   - Members: [${dreamsyncUser.id}, ${targetUserId}]`);
                console.log(`   - Private: true`);
                
                const mutualChat = await this.groupService.createGroup(
                    chatName,
                    chatDescription,
                    dreamsyncUser.id, // DreamSync is the owner
                    [dreamsyncUser.id], // DreamSync is admin
                    [dreamsyncUser.id, targetUserId], // Both users are participants
                    undefined, // No charter
                    true, // isPrivate
                    "private", // visibility
                    undefined, // avatarUrl
                    undefined, // bannerUrl
                    [] // originalMatchParticipants
                );

                console.log(`✅ Created new mutual chat: ${mutualChat.id}`);
                console.log(`📋 New chat details: Name="${mutualChat.name}", Private=${mutualChat.isPrivate}, Members=${mutualChat.members?.length || 0}`);
                return { chat: mutualChat, wasCreated: true };
            } catch (error) {
                console.error("❌ Error creating mutual chat:", error);
                return { chat: null, wasCreated: false };
            }
        });
    }

    /**
     * Generate AI message about the match
     */
    async generateMatchMessage(match: Match, userId: string): Promise<string> {
        // Safety check for user relations
        const userA = match.userA || { ename: "Unknown User", name: "Unknown User" };
        const userB = match.userB || { ename: "Unknown User", name: "Unknown User" };
        
        try {
            
            // Determine which user is receiving the message
            const currentUser = userA.id === userId ? userA : userB;
            const otherUser = userA.id === userId ? userB : userA;
            
            const prompt = `
You are DreamSync, an AI-powered wishlist matching platform. Generate a professional, concise message to inform ${currentUser.name || currentUser.ename} about a potential match with ${otherUser.name || otherUser.ename}.

Match Details:
- Match Type: ${match.type}
- Confidence: ${Math.round(match.matchData.confidence * 100)}%
- Reason: ${match.reason}
- Suggested Activities: ${match.matchData.suggestedActivities?.join(", ") || "None specified"}

Current User (receiving message): ${currentUser.ename || currentUser.name || "Unknown"}
Other User (being matched with): ${otherUser.ename || otherUser.name || "Unknown"}

IMPORTANT: 
1. When referencing users in your message, use the format {DisplayName} where DisplayName is their actual display name
2. Current user display name: "${currentUser.name || currentUser.ename}"
3. Other user display name: "${otherUser.name || otherUser.ename}"
4. Determine if this is a GROUP activity (chess, sports, group projects, events) or PERSONAL connection (babysitting, tutoring, personal services)
5. Mention whether this could become a group interest or is a personal connection

Write a professional message TO ${currentUser.name || currentUser.ename} that:
1. Is concise and to the point (under 150 words)
2. Explains the match reason clearly
3. Mentions specific suggested activities
4. Uses professional tone
5. References the other user using {${otherUser.name || otherUser.ename}} format
6. Indicates if this is a group activity or personal connection
7. Encourages connection professionally
8. Includes "Consider checking out their Blabsy and Pictique profiles" with proper HTML links
9. Ends with "Best regards, DreamSync Team"
10. Includes "Reply with the Match ID to connect with {${otherUser.name || otherUser.ename}}"

Example: "We found a potential match between you and {${otherUser.name || otherUser.ename}} based on your shared interest in web development. This could be a great group collaboration opportunity. Consider checking out their <a href='${otherUser.ename || 'profile'}'>Blabsy</a> and <a href='${otherUser.ename || 'profile'}'>Pictique</a> profiles to learn more about their work. Reply with the Match ID to connect with {${otherUser.name || otherUser.ename}}."
            `.trim();

            const response = await this.openai.chat.completions.create({
                model: "gpt-4",
                messages: [
                    {
                        role: "system",
                        content: "You are DreamSync, a professional AI assistant that helps people find meaningful connections based on their wishlists. Write concise, professional messages about potential matches using {ename} format for user references."
                    },
                    {
                        role: "user",
                        content: prompt,
                    },
                ],
                max_tokens: 300,
                temperature: 0.7,
            });

            const message = response.choices[0]?.message?.content?.trim();
            if (!message) {
                throw new Error("OpenAI returned empty message");
            }

            // Convert {ename} references to HTML links
            const processedMessage = this.convertEnameToLinks(message, match, userId);

            // Add system message prefix and match ID to the message for tracking purposes
            return `$$system-message$$\n\n${processedMessage}\n\n[Match ID: ${match.id}]`;
        } catch (error) {
            console.error("Error generating match message:", error);
            // Fallback message - user-specific
            const currentUser = userA.id === userId ? userA : userB;
            const otherUser = userA.id === userId ? userB : userA;
            
            const fallbackMessage = `We found a potential match between you and {${otherUser.name || otherUser.ename || "user2"}} based on your wishlist compatibility.

${match.reason}

Suggested activities: ${match.matchData.suggestedActivities?.join(", ") || "Connect and explore together"}

Consider checking out their <a href='placeholder'>Blabsy</a> and <a href='placeholder'>Pictique</a> profiles to learn more about their work.

Reply with the Match ID to connect with {${otherUser.name || otherUser.ename || "user2"}}.

Best regards,
DreamSync`;
            
            const processedFallback = this.convertEnameToLinks(fallbackMessage, match, userId);
            
            return `$$system-message$$

${processedFallback}

[Match ID: ${match.id}]`;
        }
    }

    /**
     * Generate AI message for multi-user matches
     */
    async generateMultiUserMatchMessage(match: Match, currentUser: User, otherUserIds: string[]): Promise<string> {
        try {
            // Check if this is a "join existing group" match
            if (match.matchData?.isJoinExistingGroup && match.matchData?.existingGroupId) {
                return await this.generateJoinExistingGroupMessage(match, currentUser, otherUserIds);
            }
            
            // Get other users' information
            const otherUsers = await Promise.all(
                otherUserIds.map(id => this.userService.getUserById(id))
            );
            const validOtherUsers = otherUsers.filter(user => user !== null) as User[];
            
            const otherUserNames = validOtherUsers.map(user => user.name || user.ename || "Unknown").join(", ");
            const totalUsers = otherUserIds.length + 1; // +1 for current user
            const consentThreshold = match.matchData?.consentThreshold || 2;
            
            const prompt = `
You are DreamSync, an AI-powered wishlist matching platform. Generate a professional, concise message to inform ${currentUser.name || currentUser.ename} about a potential group match with ${otherUserIds.length} other users.

Match Details:
- Match Type: ${match.type}
- Confidence: ${Math.round(match.matchData.confidence * 100)}%
- Reason: ${match.reason}
- Suggested Activities: ${match.matchData.suggestedActivities?.join(", ") || "None specified"}
- Total Users: ${totalUsers}
- Consent Threshold: ${consentThreshold} users needed

Current User (receiving message): ${currentUser.ename || currentUser.name || "Unknown"}
Other Users (being matched with): ${otherUserNames}

IMPORTANT: 
1. When referencing users in your message, use the format {DisplayName} where DisplayName is their actual display name
2. Current user display name: "${currentUser.name || currentUser.ename}"
3. Other users display names: "${otherUserNames}"
4. This is a GROUP activity with ${totalUsers} total users
5. Mention that ${consentThreshold} users need to consent to create the group
6. Emphasize the group nature of this match

Write a professional message TO ${currentUser.name || currentUser.ename} that:
1. Is concise and to the point (under 150 words)
2. Explains the group match reason clearly
3. Mentions specific suggested activities
4. Uses professional tone
5. References the other users using {${otherUserNames}} format
6. Indicates this is a group activity
7. Mentions that ${consentThreshold} users need to consent
8. Encourages group participation professionally
9. Includes individual profile links for each user (for new group creation)
10. Ends with "Best regards, DreamSync Team"

Example: "We found a potential group match between you and {${otherUserNames}} based on your shared interest in ${match.matchData.activityCategory || 'collaboration'}. This is a great group activity opportunity with ${totalUsers} total participants. ${consentThreshold} users need to consent to create this group. Consider checking out their profiles: {${otherUserNames}} - <a href='placeholder'>Blabsy</a> | <a href='placeholder'>Pictique</a>"
            `.trim();

            const completion = await this.openai.chat.completions.create({
                model: "gpt-4",
                messages: [{ role: "user", content: prompt }],
                max_tokens: 200,
                temperature: 0.7,
            });

            const aiMessage = completion.choices[0]?.message?.content || "";
            console.log("🤖 AI generated multi-user match message:", aiMessage);
            
            return aiMessage;
        } catch (error) {
            console.error("Error generating multi-user match message:", error);
            // Fallback message
            const otherUserNames = otherUserIds.map(id => "user").join(", ");
            const totalUsers = otherUserIds.length + 1;
            const consentThreshold = match.matchData?.consentThreshold || 2;
            
            const fallbackMessage = `We found a potential group match between you and ${otherUserIds.length} other users based on your wishlist compatibility.

${match.reason}

This is a group activity with ${totalUsers} total participants. ${consentThreshold} users need to consent to create this group.

Suggested activities: ${match.matchData.suggestedActivities?.join(", ") || "Connect and explore together"}

Consider checking out their profiles: ${otherUserNames} - <a href='placeholder'>Blabsy</a> | <a href='placeholder'>Pictique</a>

Best regards,
DreamSync Team`;
            
            return fallbackMessage;
        }
    }

    /**
     * Generate AI message for joining an existing group
     */
    async generateJoinExistingGroupMessage(match: Match, currentUser: User, otherUserIds: string[]): Promise<string> {
        try {
            // Get the existing group information
            const groupRepository = AppDataSource.getRepository(Group);
            const existingGroup = await groupRepository.findOne({
                where: { id: match.matchData?.existingGroupId },
                relations: ["members"]
            });
            
            if (!existingGroup) {
                console.error(`❌ Existing group not found: ${match.matchData?.existingGroupId}`);
                return this.generateMultiUserMatchMessage(match, currentUser, otherUserIds); // Fallback
            }
            
            // Get other users' information
            const otherUsers = await Promise.all(
                otherUserIds.map(id => this.userService.getUserById(id))
            );
            const validOtherUsers = otherUsers.filter(user => user !== null) as User[];
            
            const otherUserNames = validOtherUsers.map(user => user.name || user.ename || "Unknown").join(", ");
            const newUserIds = match.matchData?.newUserIds || [];
            const consentThreshold = match.matchData?.consentThreshold || 2;
            
            const prompt = `
You are DreamSync, an AI-powered wishlist matching platform. Generate a professional, concise message to inform ${currentUser.name || currentUser.ename} about joining an EXISTING group with ${otherUserIds.length} other users.

Match Details:
- Match Type: ${match.type}
- Confidence: ${Math.round(match.matchData.confidence * 100)}%
- Reason: ${match.reason}
- Suggested Activities: ${match.matchData.suggestedActivities?.join(", ") || "None specified"}
- Existing Group: ${existingGroup.name}
- New Users: ${newUserIds.length}
- Consent Threshold: ${consentThreshold} users needed

Current User (receiving message): ${currentUser.ename || currentUser.name || "Unknown"}
Other Users (being matched with): ${otherUserNames}

IMPORTANT: 
1. This is about JOINING an EXISTING group, not creating a new one
2. Emphasize that there's already an active group for this activity
3. Mention the existing group name: "${existingGroup.name}"
4. When referencing users in your message, use the format {DisplayName} where DisplayName is their actual display name
5. Current user display name: "${currentUser.name || currentUser.ename}"
6. Other users display names: "${otherUserNames}"
7. This is a GROUP activity with existing members
8. Mention that ${consentThreshold} users need to consent to join the existing group
9. Emphasize the group nature and existing community

Write a professional message TO ${currentUser.name || currentUser.ename} that:
1. Is concise and to the point (under 150 words)
2. Explains they're joining an EXISTING group
3. Mentions the existing group name
4. Uses professional tone
5. References the other users using {${otherUserNames}} format
6. Indicates this is joining an existing group activity
7. Mentions that ${consentThreshold} users need to consent to join
8. Encourages joining the existing community professionally
9. Does NOT include individual profile links (since they're joining an existing group)
10. Ends with "Best regards, DreamSync Team"

Example: "We found a potential group match between you and {${otherUserNames}} for joining the existing '${existingGroup.name}' group. This group already has active members interested in ${match.matchData.activityCategory || 'collaboration'}. ${consentThreshold} users need to consent to join this existing group."
            `.trim();

            const completion = await this.openai.chat.completions.create({
                model: "gpt-4",
                messages: [{ role: "user", content: prompt }],
                max_tokens: 200,
                temperature: 0.7,
            });

            const aiMessage = completion.choices[0]?.message?.content || "";
            console.log("🤖 AI generated join existing group message:", aiMessage);
            
            return aiMessage;
        } catch (error) {
            console.error("Error generating join existing group message:", error);
            // Fallback message
            const otherUserNames = otherUserIds.map(id => "user").join(", ");
            const newUserIds = match.matchData?.newUserIds || [];
            const consentThreshold = match.matchData?.consentThreshold || 2;
            
            const fallbackMessage = `We found a potential group match between you and ${otherUserIds.length} other users for joining an existing group.

${match.reason}

This is about joining an existing group with ${newUserIds.length} new users. ${consentThreshold} users need to consent to join this existing group.

Suggested activities: ${match.matchData.suggestedActivities?.join(", ") || "Connect and explore together"}

Best regards,
DreamSync Team`;
            
            return fallbackMessage;
        }
    }

    /**
     * Convert {ename} references to HTML links
     */
    private convertEnameToLinks(message: string, match: Match, userId: string): string {
        // Safety check for user relations
        const userA = match.userA || { ename: "Unknown User", name: "Unknown User" };
        const userB = match.userB || { ename: "Unknown User", name: "Unknown User" };
        
        let processedMessage = message;
        
        // Get display names (prefer name over ename)
        const userADisplayName = userA.name || userA.ename || "Unknown User";
        const userBDisplayName = userB.name || userB.ename || "Unknown User";
        
        // Replace {userA.displayName} with plain text name (only if it's not the current user)
        if (userADisplayName && userA.id !== userId) {
            processedMessage = processedMessage.replace(
                new RegExp(`\\{${userADisplayName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\}`, 'g'),
                userADisplayName
            );
        } else if (userADisplayName && userA.id === userId) {
            // If it's the current user, just show their name without link
            processedMessage = processedMessage.replace(
                new RegExp(`\\{${userADisplayName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\}`, 'g'),
                userADisplayName
            );
        }
        
        // Replace {userB.displayName} with plain text name (only if it's not the current user)
        if (userBDisplayName && userB.id !== userId) {
            processedMessage = processedMessage.replace(
                new RegExp(`\\{${userBDisplayName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\}`, 'g'),
                userBDisplayName
            );
        } else if (userBDisplayName && userB.id === userId) {
            // If it's the current user, just show their name without link
            processedMessage = processedMessage.replace(
                new RegExp(`\\{${userBDisplayName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\}`, 'g'),
                userBDisplayName
            );
        }
        
        // Update Blabsy and Pictique profile links with correct ename
        const otherUser = userA.id === userId ? userB : userA;
        if (otherUser.ename) {
            // Replace href values in Blabsy and Pictique links
            processedMessage = processedMessage.replace(
                /<a href='[^']*'>Blabsy<\/a>/g,
                `<a href='${new URL("/user/" + otherUser.ename, process.env.PUBLIC_BLABSY_URL).toString()}'>Blabsy</a>`
            );
            processedMessage = processedMessage.replace(
                /<a href='[^']*'>Pictique<\/a>/g,
                `<a href='${new URL("/profile/" + otherUser.ename, process.env.PUBLIC_PICTIQUE_URL).toString()}'>Pictique</a>`
            );
        }
        
        return processedMessage;
    }

    /**
     * Check if a notification has already been sent for this match
     */
    public async hasNotificationBeenSent(match: Match): Promise<boolean> {
        try {
            const dreamsyncUser = await this.findDreamSyncUser();
            if (!dreamsyncUser) {
                return false;
            }

            // Check if there are any system messages about this match
            const messageRepository = AppDataSource.getRepository(Message);
            const existingMessages = await messageRepository
                .createQueryBuilder("message")
                .leftJoin("message.group", "group")
                .leftJoin("message.sender", "sender")
                .where("message.isSystemMessage = :isSystem", { isSystem: true })
                .andWhere("sender.id = :senderId", { senderId: dreamsyncUser.id })
                .andWhere("message.text ILIKE :matchId", { matchId: `%${match.id}%` })
                .getCount();

            return existingMessages > 0;
        } catch (error) {
            console.error("Error checking if notification was sent:", error);
            return false;
        }
    }

    /**
     * Send match notification to both users
     */
    async sendMatchNotification(match: Match): Promise<void> {
        try {
            console.log(`📨 Checking if notification already sent for match: ${match.id}`);

            // Check if notification has already been sent
            const alreadySent = await this.hasNotificationBeenSent(match);
            if (alreadySent) {
                console.log(`⏭️ Notification already sent for match: ${match.id}, skipping`);
                return;
            }

            console.log(`📨 Sending match notification for match: ${match.id}`);

            // Find DreamSync user
            const dreamsyncUser = await this.findDreamSyncUser();
            if (!dreamsyncUser) {
                console.error("Cannot send notification: DreamSync user not found");
                return;
            }

            // Send notification to User A
            await this.sendNotificationToUser(match.userAId, match, dreamsyncUser);

            // Send notification to User B
            await this.sendNotificationToUser(match.userBId, match, dreamsyncUser);

            console.log(`✅ Match notifications sent successfully for match: ${match.id}`);
        } catch (error) {
            console.error("Error sending match notification:", error);
        }
    }

    /**
     * Send multi-user match notification to a specific user
     */
    async sendMultiUserMatchNotification(match: Match, userId: string): Promise<void> {
        try {
            console.log(`📨 Sending multi-user match notification to user: ${userId} for match: ${match.id}`);
            console.log(`🔍 Match isJoinExistingGroup: ${match.matchData?.isJoinExistingGroup}`);
            console.log(`🔍 Match existingGroupId: ${match.matchData?.existingGroupId}`);
            
            // Find DreamSync user
            const dreamsyncUser = await this.findDreamSyncUser();
            if (!dreamsyncUser) {
                console.error("Cannot send notification: DreamSync user not found");
                return;
            }

            // Find the target user
            const user = await this.userService.getUserById(userId);
            if (!user) {
                console.error(`Cannot send notification: User ${userId} not found`);
                return;
            }

            // Find or create mutual chat
            const userChatResult = await this.findOrCreateMutualChat(userId);
            if (!userChatResult.chat) {
                console.error(`Cannot send notification: Could not find/create chat for user ${userId}`);
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

            // Generate unique operation ID for this multi-user notification
            const operationId = `multi-user-notification-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            
            await withOperationContext('MatchNotificationService', operationId, async () => {
                // Get other users in the match (excluding current user)
                const allUserIds = match.matchData?.allUserIds || [];
                const otherUserIds = allUserIds.filter(id => id !== userId);
                const consentThreshold = match.matchData?.consentThreshold || 2;

                // Generate AI message for multi-user match
                const aiMessage = await this.generateMultiUserMatchMessage(match, user, otherUserIds);
                
                // Convert ename placeholders to actual names
                const finalMessage = this.convertEnameToLinks(aiMessage, match, userId);

                const messageContent = `$$system-message$$

${finalMessage}

Reply with the Match ID "${match.id}" to connect with the other ${otherUserIds.length} users.

[Match ID: ${match.id}]`;

                // Save the message
                const messageRepository = AppDataSource.getRepository(Message);
                const message = messageRepository.create({
                    text: messageContent,
                    sender: dreamsyncUser,
                    group: userChat,
                    isSystemMessage: true,
                });

                await messageRepository.save(message);
                console.log(`✅ Multi-user match notification sent to user: ${userId}`);
            });
            
        } catch (error) {
            console.error(`Error sending multi-user match notification to user ${userId}:`, error);
        }
    }

    /**
     * Send notification to a specific user
     */
    private async sendNotificationToUser(
        userId: string,
        match: Match,
        dreamsyncUser: User
    ): Promise<void> {
        try {
            console.log(`📤 Sending notification to user: ${userId}`);
            console.log(`📋 Match details: ID=${match.id}, Type=${match.type}, Confidence=${match.matchData.confidence}`);
            
            // Find or create mutual chat
            const chatResult = await this.findOrCreateMutualChat(userId);
            if (!chatResult.chat) {
                console.error(`❌ Failed to create mutual chat for user: ${userId}`);
                return;
            }

            const mutualChat = chatResult.chat;
            const wasCreated = chatResult.wasCreated;

            console.log(`💬 Using mutual chat: ${mutualChat.id} (${mutualChat.name})`);
            console.log(`🆕 Chat was just created: ${wasCreated}`);

            // If chat was just created, wait 15 seconds before sending message
            if (wasCreated) {
                console.log(`⏳ Chat was just created, waiting 15 seconds before sending message...`);
                await new Promise(resolve => setTimeout(resolve, 15000));
                console.log(`✅ 15-second delay completed, proceeding with message`);
            }

            // Generate unique operation ID for this message sending
            const operationId = `notification-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            
            await withOperationContext('MatchNotificationService', operationId, async () => {
                // Generate the match message for this specific user
                console.log(`🤖 Generating match message for user: ${userId}`);
                const messageContent = await this.generateMatchMessage(match, userId);
                console.log(`📝 Generated message content (first 100 chars): ${messageContent.substring(0, 100)}...`);

                // Create the message
                console.log(`💾 Creating message in database...`);
                const messageRepository = AppDataSource.getRepository(Message);
                const message = messageRepository.create({
                    text: messageContent,
                    sender: dreamsyncUser,
                    group: mutualChat,
                    isSystemMessage: true,
                });

                console.log(`💾 Saving message to database...`);
                const savedMessage = await messageRepository.save(message);
                console.log(`✅ Message saved with ID: ${savedMessage.id}`);
                console.log(`✅ Notification message sent to user ${userId} in chat ${mutualChat.id}`);
                console.log(`📊 Message stats: Length=${messageContent.length}, SystemMessage=${true}, Sender=${dreamsyncUser.id}`);
            });
        } catch (error) {
            console.error(`❌ Error sending notification to user ${userId}:`, error);
            console.error(`❌ Error details:`, (error as Error).message);
            console.error(`❌ Error stack:`, (error as Error).stack);
        }
    }

    /**
     * Process a new match and send notifications
     */
    async processMatch(match: Match): Promise<void> {
        try {
            console.log(`🔄 Processing match: ${match.id}`);
            console.log(`📊 Match data:`, JSON.stringify(match.matchData, null, 2));
            console.log(`🔍 Match type: ${match.type}`);
            console.log(`🔍 Match status: ${match.status}`);
            console.log(`🔍 Match isActive: ${match.isActive}`);
            
            // Handle join existing group matches differently (2-user matches)
            if (match.matchData?.isJoinExistingGroup && match.matchData?.existingGroupId) {
                await this.processJoinExistingGroupMatch(match);
                return;
            }

            // Handle multi-user matches differently
            if (match.matchData?.isMultiUserMatch && match.matchData?.allUserIds) {
                await this.processMultiUserMatch(match);
                return;
            }
            
            // Handle 2-user matches (existing logic)
            // Mark match as inactive by default until both users consent
            const matchRepository = AppDataSource.getRepository(Match);
            match.isActive = false;
            match.userAConsent = false;
            match.userBConsent = false;
            await matchRepository.save(match);
            
            // Send notifications to both users
            await this.sendMatchNotification(match);
            
            console.log(`✅ Match processing completed: ${match.id}`);
        } catch (error) {
            console.error(`Error processing match ${match.id}:`, error);
        }
    }

    /**
     * Process multi-user match and send notifications to all users
     */
    async processMultiUserMatch(match: Match): Promise<void> {
        try {
            console.log(`🔄 Processing multi-user match: ${match.id}`);
            
            const allUserIds = match.matchData?.allUserIds || [];
            const userConsents = match.matchData?.userConsents || {};
            const consentThreshold = match.matchData?.consentThreshold || 2;
            
            console.log(`👥 Multi-user match for ${allUserIds.length} users: ${allUserIds.join(', ')}`);
            console.log(`🎯 Consent threshold: ${consentThreshold}`);
            
            // Mark match as inactive by default until threshold is met
            const matchRepository = AppDataSource.getRepository(Match);
            match.isActive = false;
            await matchRepository.save(match);
            
            // Determine which users to send notifications to
            let usersToNotify = allUserIds;
            
            // If this is a "join existing group" match, only notify new users
            if (match.matchData?.isJoinExistingGroup && match.matchData?.newUserIds) {
                usersToNotify = match.matchData.newUserIds;
                console.log(`🏠 Join existing group match - only notifying new users: ${usersToNotify.join(', ')}`);
            }
            
            // Send notifications to selected users
            for (const userId of usersToNotify) {
                await this.sendMultiUserMatchNotification(match, userId);
            }
            
            console.log(`✅ Multi-user match processing completed: ${match.id}`);
        } catch (error) {
            console.error(`Error processing multi-user match ${match.id}:`, error);
        }
    }

    /**
     * Process join existing group match (2-user match between new user and admin)
     */
    async processJoinExistingGroupMatch(match: Match): Promise<void> {
        try {
            console.log(`🏠 Processing join existing group match: ${match.id}`);
            
            const newUserId = match.matchData?.newUserId;
            const adminUserId = match.matchData?.adminUserId;
            const groupId = match.matchData?.existingGroupId;
            
            if (!newUserId || !adminUserId || !groupId) {
                console.error("Missing required data for join existing group match:", { newUserId, adminUserId, groupId });
                return;
            }
            
            console.log(`👤 New user: ${newUserId}`);
            console.log(`👑 Admin: ${adminUserId}`);
            console.log(`🏠 Group ID: ${groupId}`);
            
            // Mark match as inactive by default until both users consent
            const matchRepository = AppDataSource.getRepository(Match);
            match.isActive = false;
            match.userAConsent = false;
            match.userBConsent = false;
            await matchRepository.save(match);
            
            // Send notification to new user (about joining a group)
            await this.sendJoinGroupNotificationToNewUser(match, newUserId, groupId);
            
            // Send notification to admin (about new user wanting to join)
            await this.sendJoinGroupNotificationToAdmin(match, adminUserId, newUserId, groupId);
            
            console.log(`✅ Join existing group match processing completed: ${match.id}`);
            
        } catch (error) {
            console.error(`Error processing join existing group match ${match.id}:`, error);
        }
    }

    /**
     * Send notification to new user about joining a group
     */
    private async sendJoinGroupNotificationToNewUser(match: Match, newUserId: string, groupId: string): Promise<void> {
        try {
            console.log(`📨 Sending join group notification to new user: ${newUserId}`);
            
            const dreamsyncUser = await this.findDreamSyncUser();
            if (!dreamsyncUser) {
                console.error("Cannot send notification: DreamSync user not found");
                return;
            }

            const group = await this.groupService.getGroupById(groupId);
            if (!group) {
                console.error(`Group not found: ${groupId}`);
                return;
            }

            const activity = match.matchData?.activityCategory || "collaboration";
            
            const messageContent = `$$system-message$$

We found an existing group that matches your interest in ${activity}!

**${group.name}** is looking for new members who share your passion for ${activity}. This is a great opportunity to connect with like-minded people and participate in group activities.

Reply with the Match ID "${match.id}" if you'd like to join this group.

[Match ID: ${match.id}]`;

            // Find or create mutual chat between DreamSync and the new user
            const mutualChatResult = await this.findOrCreateMutualChat(newUserId);
            if (!mutualChatResult.chat) {
                console.error("Failed to find or create mutual chat for new user notification");
                return;
            }
            
            const mutualChat = mutualChatResult.chat;
            const wasCreated = mutualChatResult.wasCreated;
            
            // If chat was just created, wait 15 seconds before sending message
            if (wasCreated) {
                console.log(`⏳ User chat was just created, waiting 15 seconds before sending message...`);
                await new Promise(resolve => setTimeout(resolve, 15000));
                console.log(`✅ 15-second delay completed for user message`);
            }

            const messageRepository = AppDataSource.getRepository(Message);
            const message = messageRepository.create({
                text: messageContent,
                sender: dreamsyncUser,
                group: mutualChat,
                isSystemMessage: true
            });

            await messageRepository.save(message);
            console.log(`✅ Sent join group notification to new user: ${newUserId}`);
            
        } catch (error) {
            console.error("Error sending join group notification to new user:", error);
        }
    }

    /**
     * Send notification to admin about new user wanting to join
     */
    private async sendJoinGroupNotificationToAdmin(match: Match, adminUserId: string, newUserId: string, groupId: string): Promise<void> {
        try {
            console.log(`📨 Sending join group notification to admin: ${adminUserId}`);
            
            const dreamsyncUser = await this.findDreamSyncUser();
            if (!dreamsyncUser) {
                console.error("Cannot send notification: DreamSync user not found");
                return;
            }

            const newUser = await this.userService.getUserById(newUserId);
            if (!newUser) {
                console.error(`New user not found: ${newUserId}`);
                return;
            }

            const group = await this.groupService.getGroupById(groupId);
            if (!group) {
                console.error(`Group not found: ${groupId}`);
                return;
            }

            const activity = match.matchData?.activityCategory || "collaboration";
            
            const messageContent = `$$system-message$$

A new user wants to join your group!

**${newUser.name || newUser.ename}** is interested in joining **${group.name}** based on their interest in ${activity}. They have expressed interest in participating in group activities.

Reply with the Match ID "${match.id}" if you'd like to add them to your group.

[Match ID: ${match.id}]`;

            // Find or create mutual chat between DreamSync and the admin
            const mutualChatResult = await this.findOrCreateMutualChat(adminUserId);
            if (!mutualChatResult.chat) {
                console.error("Failed to find or create mutual chat for admin notification");
                return;
            }
            
            const mutualChat = mutualChatResult.chat;
            const wasCreated = mutualChatResult.wasCreated;
            
            // If chat was just created, wait 15 seconds before sending message
            if (wasCreated) {
                console.log(`⏳ Admin chat was just created, waiting 15 seconds before sending message...`);
                await new Promise(resolve => setTimeout(resolve, 15000));
                console.log(`✅ 15-second delay completed for admin message`);
            }

            const messageRepository = AppDataSource.getRepository(Message);
            const message = messageRepository.create({
                text: messageContent,
                sender: dreamsyncUser,
                group: mutualChat,
                isSystemMessage: true
            });

            await messageRepository.save(message);
            console.log(`✅ Sent join group notification to admin: ${adminUserId}`);
            
        } catch (error) {
            console.error("Error sending join group notification to admin:", error);
        }
    }

    /**
     * Process privacy-preserving notifications when users join existing groups
     * Only the admin gets detailed information, new members get generic messages
     */
    async processGroupJoinNotification(groupId: string, newMemberId: string, match: Match): Promise<void> {
        try {
            console.log(`🔒 Processing privacy-preserving group join notification for group: ${groupId}`);
            
            const dreamsyncUser = await this.findDreamSyncUser();
            if (!dreamsyncUser) {
                console.error("DreamSync user not found for group join notification");
                return;
            }

            // Get group details
            const group = await this.groupService.getGroupById(groupId);
            if (!group) {
                console.error(`Group not found: ${groupId}`);
                return;
            }

            // Find the admin (group owner)
            const adminId = group.owner;
            const adminUser = group.members?.find(m => m.id === adminId);
            const newMember = group.members?.find(m => m.id === newMemberId);

            if (!adminUser || !newMember) {
                console.error("Admin or new member not found in group");
                return;
            }

            console.log(`👑 Privacy-preserving notification - Admin: ${adminUser.name || adminUser.ename}, New Member: ${newMember.name || newMember.ename}`);

            // Send notification to admin with full details
            await this.sendAdminGroupJoinNotification(group, adminUser, newMember, match);

            // Send generic notification to new member
            await this.sendGenericGroupJoinNotification(group, newMember, match);

            console.log(`✅ Privacy-preserving group join notifications completed for group: ${groupId}`);
        } catch (error) {
            console.error(`Error processing group join notification for group ${groupId}:`, error);
        }
    }

    /**
     * Send detailed notification to admin about new member joining
     */
    private async sendAdminGroupJoinNotification(
        group: Group, 
        adminUser: User, 
        newMember: User, 
        match: Match
    ): Promise<void> {
        try {
            const dreamsyncUser = await this.findDreamSyncUser();
            if (!dreamsyncUser) {
                console.error("DreamSync user not found for admin group join notification");
                return;
            }

            // Find or create mutual chat between DreamSync and admin
            const adminChatResult = await this.findOrCreateMutualChat(adminUser.id);
            if (!adminChatResult.chat) {
                console.error(`Failed to create admin chat for user: ${adminUser.id}`);
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

            const activity = this.extractActivityFromMatch(match);
            const messageContent = `$$system-message$$

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

            const messageRepository = AppDataSource.getRepository(Message);
            const message = messageRepository.create({
                text: messageContent,
                sender: dreamsyncUser,
                group: adminChat,
                isSystemMessage: true,
            });

            await messageRepository.save(message);
            console.log(`✅ Admin notification sent to ${adminUser.name || adminUser.ename} about new member ${newMember.name || newMember.ename}`);
        } catch (error) {
            console.error(`Error sending admin group join notification:`, error);
        }
    }

    /**
     * Send generic notification to new member (privacy-preserving)
     */
    private async sendGenericGroupJoinNotification(
        group: Group, 
        newMember: User, 
        match: Match
    ): Promise<void> {
        try {
            const dreamsyncUser = await this.findDreamSyncUser();
            if (!dreamsyncUser) {
                console.error("DreamSync user not found for generic group join notification");
                return;
            }

            // Find or create mutual chat between DreamSync and new member
            const memberChatResult = await this.findOrCreateMutualChat(newMember.id);
            if (!memberChatResult.chat) {
                console.error(`Failed to create member chat for user: ${newMember.id}`);
                return;
            }
            
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

Welcome to the ${activity} group!

You've been matched with a group based on your shared interests. This group focuses on ${activity.toLowerCase()} activities and collaboration.

You can now connect with other members who share similar interests and goals.

Best regards,
DreamSync

[Group Join for Match ID: ${match.id}]`;

            const messageRepository = AppDataSource.getRepository(Message);
            const message = messageRepository.create({
                text: messageContent,
                sender: dreamsyncUser,
                group: memberChat,
                isSystemMessage: true,
            });

            await messageRepository.save(message);
            console.log(`✅ Generic notification sent to new member ${newMember.name || newMember.ename}`);
        } catch (error) {
            console.error(`Error sending generic group join notification:`, error);
        }
    }

    /**
     * Extract activity from match data
     */
    private extractActivityFromMatch(match: Match): string {
        const activities = match.matchData.suggestedActivities || [];
        
        if (activities.some(activity => activity.toLowerCase().includes('chess'))) {
            return 'Chess';
        }
        
        if (activities.some(activity => 
            activity.toLowerCase().includes('youtube') || 
            activity.toLowerCase().includes('video')
        )) {
            return 'YouTube Collaboration';
        }
        
        if (activities.some(activity => 
            activity.toLowerCase().includes('language') || 
            activity.toLowerCase().includes('exchange')
        )) {
            return 'Language Exchange';
        }
        
        return 'Collaboration';
    }
}
