import { AppDataSource } from "../database/data-source";
import { Message } from "../database/entities/Message";
import { User } from "../database/entities/User";
import { Group } from "../database/entities/Group";

export class MessageService {
    public messageRepository = AppDataSource.getRepository(Message);
    private userRepository = AppDataSource.getRepository(User);
    private groupRepository = AppDataSource.getRepository(Group);

    async createMessage(messageData: {
        text: string;
        senderId: string;
        groupId: string;
    }): Promise<Message> {
        const sender = await this.userRepository.findOne({ where: { id: messageData.senderId } });
        const group = await this.groupRepository.findOne({ where: { id: messageData.groupId } });

        if (!sender || !group) {
            throw new Error("Sender or group not found");
        }

        const message = this.messageRepository.create({
            text: messageData.text,
            sender,
            group,
        });

        return await this.messageRepository.save(message);
    }

    async getMessageById(id: string): Promise<Message | null> {
        return await this.messageRepository.findOne({
            where: { id },
            relations: ['sender', 'group']
        });
    }

    async getGroupMessages(groupId: string): Promise<Message[]> {
        return await this.messageRepository.find({
            where: { group: { id: groupId } },
            relations: ['sender', 'group'],
            order: { createdAt: 'ASC' }
        });
    }

    async updateMessage(id: string, messageData: Partial<Message>): Promise<Message | null> {
        await this.messageRepository.update(id, messageData);
        return await this.getMessageById(id);
    }

    async deleteMessage(id: string): Promise<boolean> {
        const result = await this.messageRepository.delete(id);
        return result.affected ? result.affected > 0 : false;
    }

    async getUserMessages(userId: string): Promise<Message[]> {
        return await this.messageRepository.find({
            where: { sender: { id: userId } },
            relations: ['sender', 'group'],
            order: { createdAt: 'DESC' }
        });
    }

    async archiveMessage(id: string): Promise<Message | null> {
        await this.messageRepository.update(id, { isArchived: true });
        return await this.getMessageById(id);
    }
} 