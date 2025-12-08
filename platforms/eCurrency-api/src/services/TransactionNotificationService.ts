import { AppDataSource } from "../database/data-source";
import { User } from "../database/entities/User";
import { Group } from "../database/entities/Group";
import { Message } from "../database/entities/Message";
import { Currency } from "../database/entities/Currency";
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
            receiverId: string;
            senderName?: string;
            receiverName?: string;
            timestamp: Date;
            isSender: boolean;
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
            const messageContent = this.generateTransactionMessage(transactionDetails);

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
        receiverId: string;
        senderName?: string;
        receiverName?: string;
        timestamp: Date;
        isSender: boolean;
    }): string {
        const { amount, currency, description, senderName, receiverName, timestamp, isSender } = details;
        
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

        if (isSender) {
            return `$$system-message$$

💸 Transaction Sent

Amount: ${formattedAmount} ${currency.name}
To: ${receiverName || 'User'}
Currency: ${currency.name}
${description ? `Description: ${description}` : ''}
Time: ${formattedTime}

Your transaction has been successfully processed.

Best regards,
eCurrency Platform`;
        } else {
            return `$$system-message$$

💰 Transaction Received

Amount: ${formattedAmount} ${currency.name}
From: ${senderName || 'User'}
Currency: ${currency.name}
${description ? `Description: ${description}` : ''}
Time: ${formattedTime}

You have received a new transaction.

Best regards,
eCurrency Platform`;
        }
    }

    /**
     * Send transaction notifications to both sender and receiver
     */
    async sendTransactionNotifications(
        amount: number,
        currency: Currency,
        senderId: string,
        receiverId: string,
        description?: string
    ): Promise<void> {
        try {
            // Get sender and receiver user details
            const sender = await this.userService.getUserById(senderId);
            const receiver = await this.userService.getUserById(receiverId);

            if (!sender || !receiver) {
                console.error("❌ Cannot send notifications: sender or receiver not found");
                return;
            }

            const transactionDetails = {
                amount,
                currency,
                description,
                senderId,
                receiverId,
                senderName: sender.name || sender.ename,
                receiverName: receiver.name || receiver.ename,
                timestamp: new Date(),
            };

            // Send notification to sender
            console.log(`📤 Sending transaction notification to sender: ${senderId}`);
            await this.sendNotificationToUser(senderId, {
                ...transactionDetails,
                isSender: true,
            });

            // Send notification to receiver
            console.log(`📥 Sending transaction notification to receiver: ${receiverId}`);
            await this.sendNotificationToUser(receiverId, {
                ...transactionDetails,
                isSender: false,
            });

            console.log(`✅ Transaction notifications sent successfully`);
        } catch (error) {
            console.error("❌ Error sending transaction notifications:", error);
        }
    }
}

