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
            isSystemMessage: false,
        });

        return await this.messageRepository.save(message);
    }

    async createSystemMessage(messageData: {
        text: string;
        groupId: string;
    }): Promise<Message> {
        const group = await this.groupRepository.findOne({ where: { id: messageData.groupId } });

        if (!group) {
            throw new Error("Group not found");
        }

        // Add the system message prefix for web3-adapter compatibility
        const prefixedText = `$$system-message$$ ${messageData.text}`;

        const message = this.messageRepository.create({
            text: prefixedText,
            sender: null,
            group,
            isSystemMessage: true,
        });

        return await this.messageRepository.save(message);
    }

    async createSystemMessageWithoutPrefix(messageData: {
        text: string;
        groupId: string;
    }): Promise<Message> {
        const group = await this.groupRepository.findOne({ where: { id: messageData.groupId } });

        if (!group) {
            throw new Error("Group not found");
        }

        const message = this.messageRepository.create({
            text: messageData.text,
            sender: null,
            group,
            isSystemMessage: true,
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
        // Get the current message, merge the data, and save it to trigger ORM events
        const currentMessage = await this.getMessageById(id);
        if (!currentMessage) {
            throw new Error("Message not found");
        }
        
        // Merge the new data with the existing message
        Object.assign(currentMessage, messageData);
        
        // Save the merged message to trigger ORM subscribers
        const updatedMessage = await this.messageRepository.save(currentMessage);
        return updatedMessage;
    }

    async deleteMessage(id: string): Promise<boolean> {
        const result = await this.messageRepository.delete(id);
        return result.affected ? result.affected > 0 : false;
    }

    async getUserMessages(userId: string): Promise<Message[]> {
        const messages = await this.messageRepository.find({
            where: { sender: { id: userId } },
            relations: ['sender', 'group'],
            order: { createdAt: 'DESC' }
        });
        
        return messages;
    }

    async archiveMessage(id: string): Promise<Message | null> {
        // Get the current message, set archived flag, and save it to trigger ORM events
        const currentMessage = await this.getMessageById(id);
        if (!currentMessage) {
            throw new Error("Message not found");
        }
        
        currentMessage.isArchived = true;
        
        // Save the updated message to trigger ORM subscribers
        const archivedMessage = await this.messageRepository.save(currentMessage);
        return archivedMessage;
    }
} 