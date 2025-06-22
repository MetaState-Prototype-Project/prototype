import { AppDataSource } from "../database/data-source";
import { Message } from "../database/entities/Message";

export class MessageService {
    public messageRepository = AppDataSource.getRepository(Message);

    async findById(id: string): Promise<Message | null> {
        return await this.messageRepository.findOneBy({ id });
    }

    async createMessage(senderId: string, chatId: string, text: string): Promise<Message> {
        const message = this.messageRepository.create({
            sender: { id: senderId },
            chat: { id: chatId },
            text,
            isArchived: false
        });

        return await this.messageRepository.save(message);
    }
} 