import { AppDataSource } from "../database/data-source";
import { Message } from "../database/entities/Message";
import { Chat } from "../database/entities/Chat";

export class MessageService {
    public messageRepository = AppDataSource.getRepository(Message);
    private chatRepository = AppDataSource.getRepository(Chat);

    async findById(id: string): Promise<Message | null> {
        return await this.messageRepository.findOne({ 
            where: { id },
            relations: ["chat", "sender"]
        });
    }

    async createMessage(senderId: string | null, chatId: string, text: string, isSystemMessage: boolean = false): Promise<Message> {
        const message = this.messageRepository.create({
            sender: senderId ? { id: senderId } : undefined,
            chat: { id: chatId },
            text,
            isSystemMessage,
            isArchived: false
        });

        const savedMessage = await this.messageRepository.save(message);
        
        // Update the chat's updatedAt timestamp to reflect the latest message
        const chat = await this.chatRepository.findOneBy({ id: chatId });
        if (chat) {
            chat.updatedAt = new Date();
            await this.chatRepository.save(chat);
        }

        return savedMessage;
    }

    async createSystemMessage(chatId: string, text: string): Promise<Message> {
        return this.createMessage(null, chatId, text, true);
    }
} 