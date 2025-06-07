import { AppDataSource } from "../database/data-source";
import { Chat } from "../database/entities/Chat";
import { User } from "../database/entities/User";
import { MessageReadStatus } from "../database/entities/MessageReadStatus";
import { In } from "typeorm";
import { EventEmitter } from "events";
import { Text } from "../database/entities/Text";

export class ChatService {
    private chatRepository = AppDataSource.getRepository(Chat);
    private textRepository = AppDataSource.getRepository(Text);
    private userRepository = AppDataSource.getRepository(User);
    private messageReadStatusRepository = AppDataSource.getRepository(MessageReadStatus);
    private eventEmitter = new EventEmitter();

    // Event emitter getter
    getEventEmitter(): EventEmitter {
        return this.eventEmitter;
    }

    // Chat CRUD Operations
    async createChat(
        name?: string,
        participantIds: string[] = [],
    ): Promise<Chat> {
        const participants = await this.userRepository.findBy({
            id: In(participantIds),
        });
        if (participants.length !== participantIds.length) {
            throw new Error("One or more participants not found");
        }

        const chat = this.chatRepository.create({
            chatName: name || undefined,
            users: participants,
        });
        return await this.chatRepository.save(chat);
    }

    async getChatById(id: string): Promise<Chat | null> {
        return await this.chatRepository.findOne({
            where: { id },
            relations: [
                "texts",
                "texts.author",
                "texts.readStatuses",
                "users",
            ],
        });
    }

    async updateChat(id: string, name: string): Promise<Chat> {
        const chat = await this.getChatById(id);
        if (!chat) {
            throw new Error("Chat not found");
        }
        chat.chatName = name;
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
        participantIds: string[],
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

        chat.users = [...chat.users, ...newParticipants];
        return await this.chatRepository.save(chat);
    }

    async removeParticipant(chatId: string, userId: string): Promise<Chat> {
        const chat = await this.getChatById(chatId);
        if (!chat) {
            throw new Error("Chat not found");
        }

        chat.users = chat.users.filter((p) => p.id !== userId);
        return await this.chatRepository.save(chat);
    }

    // Message Operations
    async sendMessage(
        chatId: string,
        senderId: string,
        text: string,
    ): Promise<Text> {
        const chat = await this.getChatById(chatId);
        if (!chat) {
            throw new Error("Chat not found");
        }

        const sender = await this.userRepository.findOneBy({ id: senderId });
        if (!sender) {
            throw new Error("Sender not found");
        }

        // Verify sender is a participant
        if (!chat.users.some((p) => p.id === senderId)) {
            throw new Error("Sender is not a participant in this chat");
        }

        const message = this.textRepository.create({
             content: text,
            author: sender,
            chat,
        });

        const savedMessage = await this.textRepository.save(message);

        // Create read status entries for all participants except sender
        const readStatuses = chat.users
            .filter((p) => p.id !== senderId)
            .map((user) =>
                this.messageReadStatusRepository.create({
                    text: savedMessage,
                    user,
                    isRead: false,
                }),
            );

        await this.messageReadStatusRepository.save(readStatuses);

        // Emit new message event
        this.eventEmitter.emit(`chat:${chatId}`, [savedMessage]);

        return savedMessage;
    }

    async getChatMessages(
        chatId: string,
        userId: string,
        page: number = 1,
        limit: number = 20,
    ): Promise<{
        messages: Text[];
        total: number;
        page: number;
        totalPages: number;
    }> {
        const [messages, total] = await this.textRepository.findAndCount({
            where: { chat: { id: chatId } },
            relations: ["author", "readStatuses", "readStatuses.user"],
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
        if (!chat.users.some((p) => p.id === userId)) {
            throw new Error("User is not a participant in this chat");
        }

        // First get all message IDs for this chat that were sent by other users
        const messageIds = await this.textRepository
            .createQueryBuilder("text")
            .select("text.id")
            .where("text.chat.id = :chatId", { chatId })
            .andWhere("text.author.id != :userId", { userId }) // Only messages not sent by the user
            .getMany();

        if (messageIds.length === 0) {
            return; // No messages to mark as read
        }

        // Then update the read status for these messages
        await this.messageReadStatusRepository
            .createQueryBuilder()
            .update(MessageReadStatus)
            .set({ isRead: true })
            .where("text.id IN (:...messageIds)", { messageIds: messageIds.map(m => m.id) })
            .andWhere("user.id = :userId", { userId })
            .andWhere("isRead = :isRead", { isRead: false })
            .execute();
    }

    async deleteMessage(messageId: string, userId: string): Promise<void> {
        const message = await this.textRepository.findOne({
            where: { id: messageId },
            relations: ["author"],
        });

        if (!message) {
            throw new Error("Message not found");
        }

        if (message.author.id !== userId) {
            throw new Error("Unauthorized to delete this message");
        }

        await this.textRepository.softDelete(messageId);
    }

    // Additional Utility Methods
    async getUserChats(
        userId: string,
        page: number = 1,
        limit: number = 10,
    ): Promise<{
        chats: (Chat & { latestMessage?: { content: string; isRead: boolean } })[];
        total: number;
        page: number;
        totalPages: number;
    }> {
        // First, get the chat IDs that the user is part of
        const [chatIds, total] = await this.chatRepository
            .createQueryBuilder("chat")
            .select(["chat.id", "chat.updatedAt"])
            .innerJoin("chat.users", "users")
            .where("users.id = :userId", { userId })
            .orderBy("chat.updatedAt", "DESC")
            .skip((page - 1) * limit)
            .take(limit)
            .getManyAndCount();

        // Then, load the full chat data with all relations
        const chats = await this.chatRepository.find({
            where: { id: In(chatIds.map((chat) => chat.id)) },
            relations: [
                "users",
                "texts",
                "texts.author",
                "texts.readStatuses",
                "texts.readStatuses.user",
            ],
            order: { updatedAt: "DESC" },
        });

        // For each chat, get the latest message and its read status
        const chatsWithLatestMessage = await Promise.all(
            chats.map(async (chat) => {
                const latestMessage = chat.texts[chat.texts.length - 1];
                if (!latestMessage) {
                    return { ...chat, latestMessage: undefined };
                }

                const readStatus = latestMessage.readStatuses.find(
                    (status) => status.user.id === userId
                );

                return {
                    ...chat,
                    latestMessage: {
                        content: latestMessage.content,
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
        userId: string,
    ): Promise<number> {
        return await this.messageReadStatusRepository.count({
            where: {
                text: { chat: { id: chatId } },
                user: { id: userId },
                isRead: false,
            },
        });
    }
}
