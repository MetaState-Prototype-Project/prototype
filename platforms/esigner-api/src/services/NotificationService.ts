import { AppDataSource } from "../database/data-source";
import { User } from "../database/entities/User";
import { Group } from "../database/entities/Group";
import { Message } from "../database/entities/Message";
import { File } from "../database/entities/File";
import { FileSignee } from "../database/entities/FileSignee";
import { UserService } from "./UserService";
import { GroupService } from "./GroupService";
import { MessageService } from "./MessageService";

export class NotificationService {
    private userService: UserService;
    private groupService: GroupService;
    private messageService: MessageService;
    private esignerUser: User | null = null;

    constructor() {
        this.userService = new UserService();
        this.groupService = new GroupService();
        this.messageService = new MessageService();
    }

    /**
     * Find the eSigner platform user by searching for "eSigner Platform" in their name
     */
    public async findESignerUser(): Promise<User | null> {
        if (this.esignerUser) {
            return this.esignerUser;
        }

        try {
            // Search for users with "eSigner Platform" in their name
            const users = await this.userService.searchUsers("eSigner Platform");
            this.esignerUser = users.find(user => 
                user.name?.includes("eSigner Platform")
            ) || null;

            if (!this.esignerUser) {
                console.error("❌ eSigner platform user not found in database");
            } else {
                console.log(`✅ Found eSigner platform user: ${this.esignerUser.id}`);
            }

            return this.esignerUser;
        } catch (error) {
            console.error("Error finding eSigner user:", error);
            return null;
        }
    }

    /**
     * Find or create a mutual chat between eSigner user and another user
     * Returns both the chat and whether it was just created
     */
    async findOrCreateMutualChat(targetUserId: string): Promise<{ chat: Group | null; wasCreated: boolean }> {
        console.log(`🔍 Looking for mutual chat between eSigner and user: ${targetUserId}`);
        
        const esignerUser = await this.findESignerUser();
        if (!esignerUser) {
            console.error("❌ Cannot create mutual chat: eSigner user not found");
            return { chat: null, wasCreated: false };
        }

        console.log(`👤 eSigner user found: ${esignerUser.id} (${esignerUser.name || esignerUser.ename})`);

        try {
            // Check if a mutual chat already exists between these two users
            console.log(`🔍 Checking for existing mutual chat between eSigner (${esignerUser.id}) and user (${targetUserId})`);
            
            const existingChat = await this.groupService.findGroupByMembers([
                esignerUser.id,
                targetUserId
            ]);

            if (existingChat) {
                console.log(`✅ Found existing mutual chat: ${existingChat.id}`);
                console.log(`📋 Chat details: Name="${existingChat.name}", Private=${existingChat.isPrivate}, Members=${existingChat.members?.length || 0}`);
                return { chat: existingChat, wasCreated: false };
            }

            console.log(`🆕 No existing mutual chat found, creating new one...`);

            // Create a new mutual chat
            const chatName = `eSigner Chat with ${targetUserId}`;
            const chatDescription = `DM ID: ${targetUserId}::${esignerUser.id}`;
            
            console.log(`🔧 Creating mutual chat with:`);
            console.log(`   - Name: ${chatName}`);
            console.log(`   - Description: ${chatDescription}`);
            console.log(`   - Owner: ${esignerUser.id}`);
            console.log(`   - Members: [${esignerUser.id}, ${targetUserId}]`);
            console.log(`   - Private: true`);
            
            const mutualChat = await this.groupService.createGroup(
                chatName,
                chatDescription,
                esignerUser.id, // eSigner is the owner
                [esignerUser.id], // eSigner is admin
                [esignerUser.id, targetUserId], // Both users are participants
                undefined, // No charter
                true, // isPrivate
                "private", // visibility
                undefined, // avatarUrl
                undefined, // bannerUrl
                [] // originalMatchParticipants
            );

            // Double-check: if createGroup returned an existing chat (due to race condition), verify it's the right one
            if (mutualChat.id) {
                const verifyChat = await this.groupService.findGroupByMembers([
                    esignerUser.id,
                    targetUserId
                ]);
                
                if (verifyChat && verifyChat.id !== mutualChat.id) {
                    console.log(`⚠️ Race condition detected: found different chat ${verifyChat.id}, using it instead`);
                    return { chat: verifyChat, wasCreated: false };
                }
            }

            console.log(`✅ Created new mutual chat: ${mutualChat.id}`);
            console.log(`📋 New chat details: Name="${mutualChat.name}", Private=${mutualChat.isPrivate}, Members=${mutualChat.members?.length || 0}`);
            return { chat: mutualChat, wasCreated: true };
        } catch (error) {
            console.error("❌ Error creating mutual chat:", error);
            return { chat: null, wasCreated: false };
        }
    }

    /**
     * Send signing invitation notification to a user
     */
    async sendInvitationNotification(userId: string, file: File, inviterName?: string): Promise<void> {
        try {
            const esignerUser = await this.findESignerUser();
            if (!esignerUser) {
                console.error("❌ Cannot send notification: eSigner user not found");
                return;
            }

            // Find or create mutual chat
            const chatResult = await this.findOrCreateMutualChat(userId);
            if (!chatResult.chat) {
                console.error(`❌ Cannot send notification: failed to create chat for user ${userId}`);
                return;
            }

            const mutualChat = chatResult.chat;
            const wasCreated = chatResult.wasCreated;

            // If chat was just created, wait 5 seconds before sending message
            if (wasCreated) {
                console.log(`⏳ Chat was just created, waiting 5 seconds before sending message...`);
                await new Promise(resolve => setTimeout(resolve, 5000));
                console.log(`✅ 5-second delay completed for invitation message`);
            }

            // Generate the invitation message
            const messageContent = this.generateInvitationMessage(file, inviterName);

            console.log(`💾 Creating invitation notification message...`);
            const message = await this.messageService.createSystemMessage({
                text: messageContent,
                groupId: mutualChat.id,
            });

            console.log(`✅ Message saved with ID: ${message.id}`);
            console.log(`✅ Invitation notification sent to user ${userId} in chat ${mutualChat.id}`);
        } catch (error) {
            console.error(`❌ Error sending invitation notification to user ${userId}:`, error);
            console.error(`❌ Error details:`, (error as Error).message);
            console.error(`❌ Error stack:`, (error as Error).stack);
        }
    }

    /**
     * Send signature completion notification to a user
     */
    async sendSignatureNotification(userId: string, file: File, signerName?: string): Promise<void> {
        try {
            const esignerUser = await this.findESignerUser();
            if (!esignerUser) {
                console.error("❌ Cannot send notification: eSigner user not found");
                return;
            }

            // Find or create mutual chat
            const chatResult = await this.findOrCreateMutualChat(userId);
            if (!chatResult.chat) {
                console.error(`❌ Cannot send notification: failed to create chat for user ${userId}`);
                return;
            }

            const mutualChat = chatResult.chat;
            const wasCreated = chatResult.wasCreated;

            // If chat was just created, wait 5 seconds before sending message
            if (wasCreated) {
                console.log(`⏳ Chat was just created, waiting 5 seconds before sending message...`);
                await new Promise(resolve => setTimeout(resolve, 5000));
                console.log(`✅ 5-second delay completed for signature message`);
            }

            // Generate the signature message
            const messageContent = this.generateSignatureMessage(file, signerName);

            console.log(`💾 Creating signature notification message...`);
            const message = await this.messageService.createSystemMessage({
                text: messageContent,
                groupId: mutualChat.id,
            });

            console.log(`✅ Message saved with ID: ${message.id}`);
            console.log(`✅ Signature notification sent to user ${userId} in chat ${mutualChat.id}`);
        } catch (error) {
            console.error(`❌ Error sending signature notification to user ${userId}:`, error);
            console.error(`❌ Error details:`, (error as Error).message);
            console.error(`❌ Error stack:`, (error as Error).stack);
        }
    }

    /**
     * Send fully signed notification to all signees
     */
    async sendFullySignedNotification(file: File, signeeIds: string[]): Promise<void> {
        try {
            const esignerUser = await this.findESignerUser();
            if (!esignerUser) {
                console.error("❌ Cannot send notification: eSigner user not found");
                return;
            }

            // Send notification to all signees
            for (const userId of signeeIds) {
                try {
                    // Find or create mutual chat
                    const chatResult = await this.findOrCreateMutualChat(userId);
                    if (!chatResult.chat) {
                        console.error(`❌ Cannot send notification: failed to create chat for user ${userId}`);
                        continue;
                    }

                    const mutualChat = chatResult.chat;
                    const wasCreated = chatResult.wasCreated;

                    // If chat was just created, wait 5 seconds before sending message
                    if (wasCreated) {
                        console.log(`⏳ Chat was just created, waiting 5 seconds before sending message...`);
                        await new Promise(resolve => setTimeout(resolve, 5000));
                        console.log(`✅ 5-second delay completed for fully signed message`);
                    }

                    // Generate the fully signed message
                    const messageContent = this.generateFullySignedMessage(file);

                    console.log(`💾 Creating fully signed notification message...`);
                    const message = await this.messageService.createSystemMessage({
                        text: messageContent,
                        groupId: mutualChat.id,
                    });

                    console.log(`✅ Message saved with ID: ${message.id}`);
                    console.log(`✅ Fully signed notification sent to user ${userId} in chat ${mutualChat.id}`);
                } catch (error) {
                    console.error(`❌ Error sending fully signed notification to user ${userId}:`, error);
                }
            }
        } catch (error) {
            console.error(`❌ Error sending fully signed notifications:`, error);
        }
    }

    /**
     * Generate invitation message content
     */
    private generateInvitationMessage(file: File, inviterName?: string): string {
        const formattedTime = new Date().toLocaleString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });

        const inviterText = inviterName ? ` from ${inviterName}` : '';
        const containerName = file.displayName || file.name;
        const descriptionText = file.description ? `\nDescription: ${file.description}` : '';

        return `📝 Signature Invitation

You have been invited${inviterText} to sign a signature container.

Signature Container: ${containerName}${descriptionText}
File: ${file.name}
Size: ${this.formatFileSize(file.size)}
Type: ${file.mimeType}
Time: ${formattedTime}

Please review and sign the signature container when ready.`;
    }

    /**
     * Generate signature message content
     */
    private generateSignatureMessage(file: File, signerName?: string): string {
        const formattedTime = new Date().toLocaleString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });

        const signerText = signerName ? ` by ${signerName}` : '';
        const containerName = file.displayName || file.name;
        const descriptionText = file.description ? `\nDescription: ${file.description}` : '';

        return `✅ Signature Completed

A signature container has been signed${signerText}.

Signature Container: ${containerName}${descriptionText}
File: ${file.name}
Time: ${formattedTime}

The signature has been recorded and verified.`;
    }

    /**
     * Generate fully signed message content
     */
    private generateFullySignedMessage(file: File): string {
        const formattedTime = new Date().toLocaleString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });

        const containerName = file.displayName || file.name;
        const descriptionText = file.description ? `\nDescription: ${file.description}` : '';

        return `🎉 Signature Container Fully Signed

All parties have signed the signature container.

Signature Container: ${containerName}${descriptionText}
File: ${file.name}
Time: ${formattedTime}

The signature container is now complete. You can download the proof from the eSigner platform.`;
    }

    /**
     * Format file size
     */
    private formatFileSize(bytes: number): string {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
}

