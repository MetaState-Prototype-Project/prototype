import { AppDataSource } from "../database/data-source";
import { User } from "../database/entities/User";
import { Group } from "../database/entities/Group";
import { Message } from "../database/entities/Message";
import { Currency } from "../database/entities/Currency";
import { AccountType } from "../database/entities/Ledger";
import { UserService } from "./UserService";
import { GroupService } from "./GroupService";
import { MessageService } from "./MessageService";

export class TransactionNotificationService {
    private userService: UserService;
    private groupService: GroupService;
    private messageService: MessageService;
    private ecurrencyUser: User | null = null;

    constructor() {
        this.userService = new UserService();
        this.groupService = new GroupService();
        this.messageService = new MessageService();
    }

    /**
     * Find the eCurrency platform user by searching for "eCurrency Platform" in their name
     */
    public async findECurrencyUser(): Promise<User | null> {
        if (this.ecurrencyUser) {
            return this.ecurrencyUser;
        }

        try {
            // Search for users with "eCurrency Platform" in their name
            const users = await this.userService.searchUsers("eCurrency Platform");
            this.ecurrencyUser = users.find(user => 
                user.name?.includes("eCurrency Platform")
            ) || null;

            if (!this.ecurrencyUser) {
                console.error("❌ eCurrency platform user not found in database");
            } else {
                console.log(`✅ Found eCurrency platform user: ${this.ecurrencyUser.id}`);
            }

            return this.ecurrencyUser;
        } catch (error) {
            console.error("Error finding eCurrency user:", error);
            return null;
        }
    }

    /**
     * Find or create a mutual chat between eCurrency user and another user
     * Returns both the chat and whether it was just created
     */
    async findOrCreateMutualChat(targetUserId: string): Promise<{ chat: Group | null; wasCreated: boolean }> {
        console.log(`🔍 Looking for mutual chat between eCurrency and user: ${targetUserId}`);
        
        const ecurrencyUser = await this.findECurrencyUser();
        if (!ecurrencyUser) {
            console.error("❌ Cannot create mutual chat: eCurrency user not found");
            return { chat: null, wasCreated: false };
        }

        console.log(`👤 eCurrency user found: ${ecurrencyUser.id} (${ecurrencyUser.name || ecurrencyUser.ename})`);

        try {
            // Check if a mutual chat already exists between these two users
            console.log(`🔍 Checking for existing mutual chat between eCurrency (${ecurrencyUser.id}) and user (${targetUserId})`);
            
            const existingChat = await this.groupService.findGroupByMembers([
                ecurrencyUser.id,
                targetUserId
            ]);

            if (existingChat) {
                console.log(`✅ Found existing mutual chat: ${existingChat.id}`);
                console.log(`📋 Chat details: Name="${existingChat.name}", Private=${existingChat.isPrivate}, Members=${existingChat.members?.length || 0}`);
                return { chat: existingChat, wasCreated: false };
            }

            console.log(`🆕 No existing mutual chat found, creating new one...`);

            // Create a new mutual chat
            const chatName = `eCurrency Chat with ${targetUserId}`;
            const chatDescription = `DM ID: ${targetUserId}::${ecurrencyUser.id}`;
            
            console.log(`🔧 Creating mutual chat with:`);
            console.log(`   - Name: ${chatName}`);
            console.log(`   - Description: ${chatDescription}`);
            console.log(`   - Owner: ${ecurrencyUser.id}`);
            console.log(`   - Members: [${ecurrencyUser.id}, ${targetUserId}]`);
            console.log(`   - Private: true`);
            
            const mutualChat = await this.groupService.createGroup(
                chatName,
                chatDescription,
                ecurrencyUser.id, // eCurrency is the owner
                [ecurrencyUser.id], // eCurrency is admin
                [ecurrencyUser.id, targetUserId], // Both users are participants
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
                    ecurrencyUser.id,
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
     * Send transaction notification to a specific user
     */
    private async sendNotificationToUser(
        userId: string,
        transactionDetails: {
            amount: number;
            currency: Currency;
            description?: string;
            senderId: string;
            senderAccountType: AccountType;
            receiverId: string;
            receiverAccountType: AccountType;
            senderName?: string;
            receiverName?: string;
            timestamp: Date;
            isSender: boolean;
            accountId?: string; // The account this notification is about (for group admins)
            accountType?: AccountType; // The account type this notification is about
        }
    ): Promise<void> {
        try {
            const ecurrencyUser = await this.findECurrencyUser();
            if (!ecurrencyUser) {
                console.error("❌ Cannot send notification: eCurrency user not found");
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

            // If chat was just created, wait 15 seconds before sending message
            if (wasCreated) {
                console.log(`⏳ Chat was just created, waiting 15 seconds before sending message...`);
                await new Promise(resolve => setTimeout(resolve, 15000));
                console.log(`✅ 15-second delay completed for transaction message`);
            }

            // Generate the transaction message
            const messageContent = this.generateTransactionMessage({
                ...transactionDetails,
                accountId: transactionDetails.accountId,
                accountType: transactionDetails.accountType,
            });

            console.log(`💾 Creating transaction notification message...`);
            const messageRepository = AppDataSource.getRepository(Message);
            const message = messageRepository.create({
                text: messageContent,
                sender: ecurrencyUser,
                group: mutualChat,
                isSystemMessage: true,
            });

            console.log(`💾 Saving message to database...`);
            const savedMessage = await messageRepository.save(message);
            console.log(`✅ Message saved with ID: ${savedMessage.id}`);
            console.log(`✅ Transaction notification sent to user ${userId} in chat ${mutualChat.id}`);
        } catch (error) {
            console.error(`❌ Error sending transaction notification to user ${userId}:`, error);
            console.error(`❌ Error details:`, (error as Error).message);
            console.error(`❌ Error stack:`, (error as Error).stack);
        }
    }

    /**
     * Generate transaction message content
     */
    private generateTransactionMessage(details: {
        amount: number;
        currency: Currency;
        description?: string;
        senderId: string;
        senderAccountType: AccountType;
        receiverId: string;
        receiverAccountType: AccountType;
        senderName?: string;
        receiverName?: string;
        timestamp: Date;
        isSender: boolean;
        accountId?: string; // The account this notification is about
        accountType?: AccountType; // The account type this notification is about
    }): string {
        const { amount, currency, senderName, receiverName, timestamp, isSender, accountType, senderAccountType, receiverAccountType } = details;
        
        const formattedAmount = amount.toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
        
        const formattedTime = timestamp.toLocaleString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });

        const emoji = isSender ? '💸' : '💰';
        const action = isSender ? 'Sent' : 'Received';
        
        // Determine account type text
        let accountText = 'personal account';
        if (accountType === AccountType.GROUP) {
            const accountName = isSender ? senderName : receiverName;
            accountText = `group account of ${accountName || 'Group'}`;
        }

        // Determine sender/recipient info
        const otherPartyName = isSender 
            ? (receiverAccountType === AccountType.GROUP ? `${receiverName} (Group)` : receiverName || 'User')
            : (senderAccountType === AccountType.GROUP ? `${senderName} (Group)` : senderName || 'User');
        
        const otherPartyLabel = isSender ? 'recipient' : 'sender';

        return `$$system-message$$

${emoji} ${currency.name} ${action}

Transaction for your ${accountText} has been processed.

${isSender ? 'sent amount' : 'received amount'}: ${formattedAmount}
currency: ${currency.name} (${currency.ename})
time: ${formattedTime} UTC
${otherPartyLabel}: ${otherPartyName}`;
    }

    /**
     * Get users to notify for an account (user or group admins)
     */
    private async getUsersToNotify(accountId: string, accountType: AccountType): Promise<User[]> {
        if (accountType === AccountType.USER) {
            const user = await this.userService.getUserById(accountId);
            return user ? [user] : [];
        } else {
            // For groups, get all admins
            const group = await this.groupService.getGroupById(accountId);
            if (!group || !group.admins || group.admins.length === 0) {
                console.warn(`⚠️ Group ${accountId} has no admins, cannot send notification`);
                return [];
            }
            return group.admins;
        }
    }

    /**
     * Get account display name (user name or group name)
     */
    private async getAccountDisplayName(accountId: string, accountType: AccountType): Promise<string> {
        if (accountType === AccountType.USER) {
            const user = await this.userService.getUserById(accountId);
            return user ? (user.name || user.ename) : 'User';
        } else {
            const group = await this.groupService.getGroupById(accountId);
            return group ? (group.name || 'Group') : 'Group';
        }
    }

    /**
     * Send transaction notifications to both sender and receiver
     * Handles USER-to-USER, USER-to-GROUP, GROUP-to-USER, and GROUP-to-GROUP transfers
     */
    async sendTransactionNotifications(
        amount: number,
        currency: Currency,
        senderId: string,
        senderAccountType: AccountType,
        receiverId: string,
        receiverAccountType: AccountType,
        description?: string
    ): Promise<void> {
        try {
            // Get users to notify for sender and receiver
            const senderUsers = await this.getUsersToNotify(senderId, senderAccountType);
            const receiverUsers = await this.getUsersToNotify(receiverId, receiverAccountType);

            if (senderUsers.length === 0 && receiverUsers.length === 0) {
                console.error("❌ Cannot send notifications: no users found for sender or receiver");
                return;
            }

            // Get display names
            const senderName = await this.getAccountDisplayName(senderId, senderAccountType);
            const receiverName = await this.getAccountDisplayName(receiverId, receiverAccountType);

            const transactionDetails = {
                amount,
                currency,
                description,
                senderId,
                senderAccountType,
                receiverId,
                receiverAccountType,
                senderName,
                receiverName,
                timestamp: new Date(),
            };

            // Send notification to all sender users (user or group admins)
            for (const senderUser of senderUsers) {
                console.log(`📤 Sending transaction notification to sender: ${senderUser.id} (${senderAccountType}:${senderId})`);
                await this.sendNotificationToUser(senderUser.id, {
                    ...transactionDetails,
                    isSender: true,
                    accountId: senderId, // The account this notification is about
                    accountType: senderAccountType,
                });
            }

            // Send notification to all receiver users (user or group admins)
            for (const receiverUser of receiverUsers) {
                console.log(`📥 Sending transaction notification to receiver: ${receiverUser.id} (${receiverAccountType}:${receiverId})`);
                await this.sendNotificationToUser(receiverUser.id, {
                    ...transactionDetails,
                    isSender: false,
                    accountId: receiverId, // The account this notification is about
                    accountType: receiverAccountType,
                });
            }

            console.log(`✅ Transaction notifications sent successfully`);
        } catch (error) {
            console.error("❌ Error sending transaction notifications:", error);
        }
    }
}

