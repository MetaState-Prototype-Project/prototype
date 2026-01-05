import { AppDataSource } from "../database/data-source";
import { User } from "../database/entities/User";
import { Group } from "../database/entities/Group";
import { Message } from "../database/entities/Message";
import { File } from "../database/entities/File";
import { Folder } from "../database/entities/Folder";
import { UserService } from "./UserService";
import { GroupService } from "./GroupService";
import { MessageService } from "./MessageService";

export class NotificationService {
    private userService: UserService;
    private groupService: GroupService;
    private messageService: MessageService;
    private fileManagerUser: User | null = null;

    constructor() {
        this.userService = new UserService();
        this.groupService = new GroupService();
        this.messageService = new MessageService();
    }

    /**
     * Find the File Manager platform user by searching for "File Manager Platform" in their name
     */
    public async findFileManagerUser(): Promise<User | null> {
        if (this.fileManagerUser) {
            return this.fileManagerUser;
        }

        try {
            // Search for users with "File Manager Platform" in their name
            const users = await this.userService.searchUsers("File Manager Platform");
            this.fileManagerUser = users.find(user => 
                user.name?.includes("File Manager Platform")
            ) || null;

            if (!this.fileManagerUser) {
                console.error("❌ File Manager platform user not found in database");
            } else {
                console.log(`✅ Found File Manager platform user: ${this.fileManagerUser.id}`);
            }

            return this.fileManagerUser;
        } catch (error) {
            console.error("Error finding File Manager user:", error);
            return null;
        }
    }

    /**
     * Find or create a mutual chat between File Manager user and another user
     * Returns both the chat and whether it was just created
     */
    async findOrCreateMutualChat(targetUserId: string): Promise<{ chat: Group | null; wasCreated: boolean }> {
        console.log(`🔍 Looking for mutual chat between File Manager and user: ${targetUserId}`);
        
        const fileManagerUser = await this.findFileManagerUser();
        if (!fileManagerUser) {
            console.error("❌ Cannot create mutual chat: File Manager user not found");
            return { chat: null, wasCreated: false };
        }

        console.log(`👤 File Manager user found: ${fileManagerUser.id} (${fileManagerUser.name || fileManagerUser.ename})`);

        try {
            // Check if a mutual chat already exists between these two users
            console.log(`🔍 Checking for existing mutual chat between File Manager (${fileManagerUser.id}) and user (${targetUserId})`);
            
            const existingChat = await this.groupService.findGroupByMembers([
                fileManagerUser.id,
                targetUserId
            ]);

            if (existingChat) {
                console.log(`✅ Found existing mutual chat: ${existingChat.id}`);
                console.log(`📋 Chat details: Name="${existingChat.name}", Private=${existingChat.isPrivate}, Members=${existingChat.members?.length || 0}`);
                return { chat: existingChat, wasCreated: false };
            }

            console.log(`🆕 No existing mutual chat found, creating new one...`);

            // Create a new mutual chat
            const chatName = `File Manager Chat with ${targetUserId}`;
            const chatDescription = `DM ID: ${targetUserId}::${fileManagerUser.id}`;
            
            console.log(`🔧 Creating mutual chat with:`);
            console.log(`   - Name: ${chatName}`);
            console.log(`   - Description: ${chatDescription}`);
            console.log(`   - Owner: ${fileManagerUser.id}`);
            console.log(`   - Members: [${fileManagerUser.id}, ${targetUserId}]`);
            console.log(`   - Private: true`);
            
            const mutualChat = await this.groupService.createGroup(
                chatName,
                chatDescription,
                fileManagerUser.id, // File Manager is the owner
                [fileManagerUser.id], // File Manager is admin
                [fileManagerUser.id, targetUserId], // Both users are participants
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
                    fileManagerUser.id,
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
     * Send file shared notification to a user
     */
    async sendFileSharedNotification(userId: string, file: File, sharerName?: string): Promise<void> {
        try {
            const fileManagerUser = await this.findFileManagerUser();
            if (!fileManagerUser) {
                console.error("❌ Cannot send notification: File Manager user not found");
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
                console.log(`✅ 5-second delay completed for file shared message`);
            }

            // Generate the file shared message
            const messageContent = this.generateFileSharedMessage(file, sharerName);

            console.log(`💾 Creating file shared notification message...`);
            const message = await this.messageService.createSystemMessage({
                text: messageContent,
                groupId: mutualChat.id,
            });

            console.log(`✅ Message saved with ID: ${message.id}`);
            console.log(`✅ File shared notification sent to user ${userId} in chat ${mutualChat.id}`);
        } catch (error) {
            console.error(`❌ Error sending file shared notification to user ${userId}:`, error);
            console.error(`❌ Error details:`, (error as Error).message);
            console.error(`❌ Error stack:`, (error as Error).stack);
        }
    }

    /**
     * Send folder shared notification to a user
     */
    async sendFolderSharedNotification(userId: string, folder: Folder, sharerName?: string): Promise<void> {
        try {
            const fileManagerUser = await this.findFileManagerUser();
            if (!fileManagerUser) {
                console.error("❌ Cannot send notification: File Manager user not found");
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
                console.log(`✅ 5-second delay completed for folder shared message`);
            }

            // Generate the folder shared message
            const messageContent = this.generateFolderSharedMessage(folder, sharerName);

            console.log(`💾 Creating folder shared notification message...`);
            const message = await this.messageService.createSystemMessage({
                text: messageContent,
                groupId: mutualChat.id,
            });

            console.log(`✅ Message saved with ID: ${message.id}`);
            console.log(`✅ Folder shared notification sent to user ${userId} in chat ${mutualChat.id}`);
        } catch (error) {
            console.error(`❌ Error sending folder shared notification to user ${userId}:`, error);
            console.error(`❌ Error details:`, (error as Error).message);
            console.error(`❌ Error stack:`, (error as Error).stack);
        }
    }

    /**
     * Generate file shared message content
     */
    private generateFileSharedMessage(file: File, sharerName?: string): string {
        const formattedTime = new Date().toLocaleString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });

        const sharerText = sharerName ? ` from ${sharerName}` : '';
        const fileName = file.displayName || file.name;
        const descriptionText = file.description ? `\nDescription: ${file.description}` : '';
        const fileManagerUrl = process.env.PUBLIC_FILE_MANAGER_BASE_URL || 'http://localhost:3005';
        const fileLink = `${fileManagerUrl}/files/${file.id}`;

        return `📁 File Shared

You have been granted access${sharerText} to a file.

File: ${fileName}${descriptionText}
Original Name: ${file.name}
Size: ${this.formatFileSize(file.size)}
Type: ${file.mimeType}
Time: ${formattedTime}

<a href="${fileLink}">View File in File Manager</a>`;
    }

    /**
     * Generate folder shared message content
     */
    private generateFolderSharedMessage(folder: Folder, sharerName?: string): string {
        const formattedTime = new Date().toLocaleString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });

        const sharerText = sharerName ? ` from ${sharerName}` : '';
        const fileManagerUrl = process.env.PUBLIC_FILE_MANAGER_BASE_URL || 'http://localhost:3005';
        const folderLink = folder.parentFolderId 
            ? `${fileManagerUrl}/files?folderId=${folder.id}`
            : `${fileManagerUrl}/files?folderId=${folder.id}`;

        return `📂 Folder Shared

You have been granted access${sharerText} to a folder.

Folder: ${folder.name}
Time: ${formattedTime}

<a href="${folderLink}">View Folder in File Manager</a>`;
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

