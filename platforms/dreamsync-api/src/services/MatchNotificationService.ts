import { AppDataSource } from "../database/data-source";
import { User } from "../database/entities/User";
import { Group } from "../database/entities/Group";
import { Message } from "../database/entities/Message";
import { Match } from "../database/entities/Match";
import { UserService } from "./UserService";
import { GroupService } from "./GroupService";
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
     */
    async findOrCreateMutualChat(targetUserId: string): Promise<Group | null> {
        const dreamsyncUser = await this.findDreamSyncUser();
        if (!dreamsyncUser) {
            console.error("Cannot create mutual chat: DreamSync user not found");
            return null;
        }

        try {
            // Check if a mutual chat already exists between these two users
            const existingChat = await this.groupService.findGroupByMembers([
                dreamsyncUser.id,
                targetUserId
            ]);

            if (existingChat) {
                console.log(`✅ Found existing mutual chat: ${existingChat.id}`);
                return existingChat;
            }

            // Create a new mutual chat
            const chatName = `DreamSync Chat`;
            const chatDescription = `Private chat between DreamSync and user for match notifications`;
            
            const mutualChat = await this.groupService.createGroup(
                chatName,
                chatDescription,
                dreamsyncUser.id, // DreamSync is the owner
                [dreamsyncUser.id], // DreamSync is admin
                [dreamsyncUser.id, targetUserId], // Both users are participants
                undefined, // No charter
                true, // isPrivate
                "private" // visibility
            );

            console.log(`✅ Created new mutual chat: ${mutualChat.id}`);
            return mutualChat;
        } catch (error) {
            console.error("Error creating mutual chat:", error);
            return null;
        }
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
1. When referencing users in your message, use the format {Name} where Name is their display name (e.g., {John Doe} or {Alice Smith})
2. Determine if this is a GROUP activity (chess, sports, group projects, events) or PERSONAL connection (babysitting, tutoring, personal services)
3. Mention whether this could become a group interest or is a personal connection

Write a professional message TO ${currentUser.name || currentUser.ename} that:
1. Is concise and to the point (under 150 words)
2. Explains the match reason clearly
3. Mentions specific suggested activities
4. Uses professional tone
5. References users using {Name} format (display names, not usernames)
6. Indicates if this is a group activity or personal connection
7. Encourages connection professionally
8. Includes "Consider checking out their Blabsy and Pictique profiles" with proper HTML links
9. Ends with "Best regards, DreamSync"
10. Includes "Reply 'yes' to this message if you'd like to connect with {Name}"

Example: "We found a potential match between you and {Alice Smith} based on your shared interest in web development. This could be a great group collaboration opportunity. Consider checking out their <a href='alice_smith'>Blabsy</a> and <a href='alice_smith'>Pictique</a> profiles to learn more about their work. Reply 'yes' to this message if you'd like to connect with {Alice Smith}."
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

Reply 'yes' to this message if you'd like to connect with {${otherUser.name || otherUser.ename || "user2"}}.

Best regards,
DreamSync`;
            
            const processedFallback = this.convertEnameToLinks(fallbackMessage, match, userId);
            
            return `$$system-message$$

${processedFallback}

[Match ID: ${match.id}]`;
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
        
        // Replace {userA.name} with plain text name (only if it's not the current user)
        if (userA.name && userA.id !== userId) {
            processedMessage = processedMessage.replace(
                new RegExp(`\\{${userA.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\}`, 'g'),
                userA.name
            );
        } else if (userA.name && userA.id === userId) {
            // If it's the current user, just show their name without link
            processedMessage = processedMessage.replace(
                new RegExp(`\\{${userA.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\}`, 'g'),
                userA.name
            );
        }
        
        // Replace {userB.name} with plain text name (only if it's not the current user)
        if (userB.name && userB.id !== userId) {
            processedMessage = processedMessage.replace(
                new RegExp(`\\{${userB.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\}`, 'g'),
                userB.name
            );
        } else if (userB.name && userB.id === userId) {
            // If it's the current user, just show their name without link
            processedMessage = processedMessage.replace(
                new RegExp(`\\{${userB.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\}`, 'g'),
                userB.name
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
                `<a href='${new URL("/user/" + otherUser.ename, process.env.PUBLIC_PICTIQUE_URL).toString()}'>Pictique</a>`
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
     * Send notification to a specific user
     */
    private async sendNotificationToUser(
        userId: string,
        match: Match,
        dreamsyncUser: User
    ): Promise<void> {
        try {
            // Find or create mutual chat
            const mutualChat = await this.findOrCreateMutualChat(userId);
            if (!mutualChat) {
                console.error(`Failed to create mutual chat for user: ${userId}`);
                return;
            }

            // Generate the match message for this specific user
            const messageContent = await this.generateMatchMessage(match, userId);

            // Create the message
            const messageRepository = AppDataSource.getRepository(Message);
            const message = messageRepository.create({
                text: messageContent,
                sender: dreamsyncUser,
                group: mutualChat,
                isSystemMessage: true,
            });

            await messageRepository.save(message);
            console.log(`✅ Notification message sent to user ${userId} in chat ${mutualChat.id}`);
        } catch (error) {
            console.error(`Error sending notification to user ${userId}:`, error);
        }
    }

    /**
     * Process a new match and send notifications
     */
    async processMatch(match: Match): Promise<void> {
        try {
            console.log(`🔄 Processing match: ${match.id}`);
            
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
}
