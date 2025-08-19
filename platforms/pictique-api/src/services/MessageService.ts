import { AppDataSource } from "../database/data-source";
import { Message } from "../database/entities/Message";

export class MessageService {
    public messageRepository = AppDataSource.getRepository(Message);

    async findById(id: string): Promise<Message | null> {
        return await this.messageRepository.findOneBy({ id });
    }

    async createMessage(senderId: string | null, chatId: string, text: string, isSystemMessage: boolean = false): Promise<Message> {
        const message = this.messageRepository.create({
            sender: senderId ? { id: senderId } : undefined,
            chat: { id: chatId },
            text,
            isSystemMessage,
            isArchived: false
        });

        return await this.messageRepository.save(message);
    }

    async createSystemMessage(chatId: string, text: string): Promise<Message> {
        return this.createMessage(null, chatId, text, true);
    }
} 