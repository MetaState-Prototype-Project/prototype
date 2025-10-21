import { AppDataSource } from "../database/data-source";
import { Chat } from "../database/entities/Chat";
import { Message } from "../database/entities/Message";
import { User } from "../database/entities/User";
import { MessageReadStatus } from "../database/entities/MessageReadStatus";
import { In } from "typeorm";
import { EventEmitter } from "events";
import { emitter } from "./event-emitter";

export class ChatService {
    public chatRepository = AppDataSource.getRepository(Chat);
    private messageRepository = AppDataSource.getRepository(Message);
    private userRepository = AppDataSource.getRepository(User);
    private messageReadStatusRepository =
        AppDataSource.getRepository(MessageReadStatus);
    private eventEmitter: EventEmitter;

    constructor() {
        this.eventEmitter = emitter;
    }

    // Event emitter getter
    getEventEmitter(): EventEmitter {
        return this.eventEmitter;
    }

    // Chat CRUD Operations
    /**
     * Find a chat with exactly the same participants.
     * Note: This is primarily used to prevent duplicate direct messages (DMs).
     * Groups with the same members are allowed to be duplicated.
     */
    async findChatByParticipants(participantIds: string[]): Promise<Chat | null> {
        if (participantIds.length === 0) {
            return null;
        }

        // Find chats that have exactly the same participants
        const chats = await this.chatRepository
            .createQueryBuilder("chat")
            .leftJoinAndSelect("chat.participants", "participants")
            .getMany();

        // Filter chats that have exactly the same participants (order doesn't matter)
        const sortedParticipantIds = participantIds.sort();
        
        for (const chat of chats) {
            const chatParticipantIds = chat.participants.map(p => p.id).sort();
            
            if (chatParticipantIds.length === sortedParticipantIds.length &&
                chatParticipantIds.every((id, index) => id === sortedParticipantIds[index])) {
                return chat;
            }
        }

        return null;
    }

    async createChat(
        name?: string,
        participantIds: string[] = []
    ): Promise<Chat> {
        const participants = await this.userRepository.findBy({
            id: In(participantIds),
        });
        if (participants.length !== participantIds.length) {
            throw new Error("One or more participants not found");
        }

        const chat = this.chatRepository.create({
            name: name || undefined,
            participants,
        });
        return await this.chatRepository.save(chat);
    }

    async getChatById(id: string): Promise<Chat | null> {
        return await this.chatRepository.findOne({
            where: { id },
            relations: [
                "messages",
                "messages.sender",
                "messages.readStatuses",
                "participants",
            ],
        });
    }

    async updateChat(id: string, name: string): Promise<Chat> {
        const chat = await this.getChatById(id);
        if (!chat) {
            throw new Error("Chat not found");
        }
        chat.name = name;
        return await this.chatRepository.save(chat);
    }

    async deleteChat(id: string): Promise<void> {
        const chat = await this.getChatById(id);
        if (!chat) {
            throw new Error("Chat not found");
        }
        await this.chatRepository.softDelete(id);
    }

    // Participant Operations
    async addParticipants(
        chatId: string,
        participantIds: string[]
    ): Promise<Chat> {
        const chat = await this.getChatById(chatId);
        if (!chat) {
            throw new Error("Chat not found");
        }

        const newParticipants = await this.userRepository.findBy({
            id: In(participantIds),
        });
        if (newParticipants.length !== participantIds.length) {
            throw new Error("One or more participants not found");
        }

        chat.participants = [...chat.participants, ...newParticipants];
        return await this.chatRepository.save(chat);
    }

    async removeParticipant(chatId: string, userId: string): Promise<Chat> {
        const chat = await this.getChatById(chatId);
        if (!chat) {
            throw new Error("Chat not found");
        }

        chat.participants = chat.participants.filter((p) => p.id !== userId);
        return await this.chatRepository.save(chat);
    }

    // Message Operations
    async sendMessage(
        chatId: string,
        senderId: string,
        text: string
    ): Promise<Message> {
        const chat = await this.getChatById(chatId);
        if (!chat) {
            throw new Error("Chat not found");
        }

        const sender = await this.userRepository.findOneBy({ id: senderId });
        if (!sender) {
            throw new Error("Sender not found");
        }

        // Verify sender is a participant
        if (!chat.participants.some((p) => p.id === senderId)) {
            throw new Error("Sender is not a participant in this chat");
        }

        const message = this.messageRepository.create({
            text,
            sender,
            chat,
        });

        const savedMessage = await this.messageRepository.save(message);
        
        // Update the chat's updatedAt timestamp to reflect the latest message
        chat.updatedAt = new Date();
        await this.chatRepository.save(chat);
        
        console.log("Sent event", `chat:${chatId}`);
        this.eventEmitter.emit(`chat:${chatId}`, [savedMessage]);

        const readStatuses = chat.participants
            .filter((p) => p.id !== senderId)
            .map((participant) =>
                this.messageReadStatusRepository.create({
                    message: savedMessage,
                    user: participant,
                    isRead: false,
                })
            );

        await this.messageReadStatusRepository
            .save(readStatuses)
            .catch(() => null);

        return savedMessage;
    }

    async getChatMessages(
        chatId: string,
        userId: string,
        page: number = 1,
        limit: number = 20
    ): Promise<{
        messages: Message[];
        total: number;
        page: number;
        totalPages: number;
    }> {
        const [messages, total] = await this.messageRepository.findAndCount({
            where: { chat: { id: chatId } },
            relations: ["sender", "readStatuses", "readStatuses.user"],
            order: { createdAt: "ASC" },
            skip: (page - 1) * limit,
            take: limit,
        });

        return {
            messages,
            total,
            page,
            totalPages: Math.ceil(total / limit),
        };
    }

    async markMessagesAsRead(chatId: string, userId: string): Promise<void> {
        const chat = await this.getChatById(chatId);
        if (!chat) {
            throw new Error("Chat not found");
        }

        // Verify user is a participant
        if (!chat.participants.some((p) => p.id === userId)) {
            throw new Error("User is not a participant in this chat");
        }

        // First get all message IDs for this chat that were sent by other users
        // Exclude system messages (no sender) and messages sent by the current user
        const messageIds = await this.messageRepository
            .createQueryBuilder("message")
            .select("message.id")
            .where("message.chat.id = :chatId", { chatId })
            .andWhere("message.sender IS NOT NULL") // Exclude system messages
            .andWhere("message.sender.id != :userId", { userId }) // Only messages not sent by the user
            .getMany();

        if (messageIds.length === 0) {
            return; // No messages to mark as read
        }

        // Then update the read status for these messages
        await this.messageReadStatusRepository
            .createQueryBuilder()
            .update(MessageReadStatus)
            .set({ isRead: true })
            .where("message.id IN (:...messageIds)", {
                messageIds: messageIds.map((m) => m.id),
            })
            .andWhere("user.id = :userId", { userId })
            .andWhere("isRead = :isRead", { isRead: false })
            .execute();
    }

    async deleteMessage(messageId: string, userId: string): Promise<void> {
        const message = await this.messageRepository.findOne({
            where: { id: messageId },
            relations: ["sender"],
        });

        if (!message) {
            throw new Error("Message not found");
        }

        // System messages cannot be deleted by users
        if (!message.sender) {
            throw new Error("Cannot delete system messages");
        }

        if (message.sender.id !== userId) {
            throw new Error("Unauthorized to delete this message");
        }

        await this.messageRepository.softDelete(messageId);
    }

    // Additional Utility Methods
    async getUserChats(
        userId: string,
        page: number = 1,
        limit: number = 10
    ): Promise<{
        chats: (Chat & { latestMessage?: { text: string; isRead: boolean } })[];
        total: number;
        page: number;
        totalPages: number;
    }> {
        // Get chats ordered by the most recent message timestamp
        const queryBuilder = this.chatRepository
            .createQueryBuilder("chat")
            .leftJoin("chat.messages", "message")
            .innerJoin("chat.participants", "participants")
            .where("participants.id = :userId", { userId })
            .groupBy("chat.id")
            .addGroupBy("chat.name")
            .addGroupBy("chat.ename")
            .addGroupBy("chat.createdAt")
            .addGroupBy("chat.updatedAt")
            .orderBy("MAX(message.createdAt)", "DESC")
            .addOrderBy("chat.createdAt", "DESC"); // Fallback for chats without messages

        // Get total count for pagination
        const total = await queryBuilder.getCount();

        // Apply pagination
        const chats = await queryBuilder
            .skip((page - 1) * limit)
            .take(limit)
            .getMany();

        // Load full chat data with all relations for the paginated results
        const chatsWithRelations = await this.chatRepository.find({
            where: { id: In(chats.map((chat) => chat.id)) },
            relations: [
                "participants",
                "messages",
                "messages.sender",
                "messages.readStatuses",
                "messages.readStatuses.user",
            ],
        });

        // Sort the chats by latest message timestamp (since we loaded relations, we need to sort again)
        const sortedChats = chatsWithRelations.sort((a, b) => {
            const aLatestMessage = a.messages[a.messages.length - 1];
            const bLatestMessage = b.messages[b.messages.length - 1];
            
            if (!aLatestMessage && !bLatestMessage) {
                return b.createdAt.getTime() - a.createdAt.getTime();
            }
            if (!aLatestMessage) return 1;
            if (!bLatestMessage) return -1;
            
            return bLatestMessage.createdAt.getTime() - aLatestMessage.createdAt.getTime();
        });

        // For each chat, get the latest message and its read status
        const chatsWithLatestMessage = await Promise.all(
            sortedChats.map(async (chat) => {
                const latestMessage = chat.messages[chat.messages.length - 1];
                if (!latestMessage) {
                    return { ...chat, latestMessage: undefined };
                }

                const readStatus = latestMessage.readStatuses.find(
                    (status) => status.user.id === userId
                );

                return {
                    ...chat,
                    latestMessage: {
                        text: latestMessage.text,
                        isRead: readStatus?.isRead ?? false,
                    },
                };
            })
        );

        return {
            chats: chatsWithLatestMessage,
            total,
            page,
            totalPages: Math.ceil(total / limit),
        };
    }

    async getUnreadMessageCount(
        chatId: string,
        userId: string
    ): Promise<number> {
        return await this.messageReadStatusRepository.count({
            where: {
                message: { chat: { id: chatId } },
                user: { id: userId },
                isRead: false,
            },
        });
    }

    async findById(id: string): Promise<Chat | null> {
        return await this.chatRepository.findOne({
            where: { id },
            relations: ["participants"],
        });
    }
}
