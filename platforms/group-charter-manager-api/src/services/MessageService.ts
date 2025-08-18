import { AppDataSource } from "../database/data-source";
import { Message } from "../database/entities/Message";
import { User } from "../database/entities/User";
import { Group } from "../database/entities/Group";

export class MessageService {
    public messageRepository = AppDataSource.getRepository(Message);
    private userRepository = AppDataSource.getRepository(User);
    private groupRepository = AppDataSource.getRepository(Group);

    /**
     * Create a regular message from a user
     */
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

    /**
     * Create a system message (no sender, automatically synced to eVault)
     */
    async createSystemMessage(messageData: {
        text: string;
        groupId: string;
    }): Promise<Message> {
        const group = await this.groupRepository.findOne({ where: { id: messageData.groupId } });

        if (!group) {
            throw new Error("Group not found");
        }

        // Add system message prefix to identify it
        const systemText = `$$system-message$$ ${messageData.text}`;

        const message = this.messageRepository.create({
            text: systemText,
            sender: undefined, // No sender for system messages
            group,
            isSystemMessage: true,
        });

        return await this.messageRepository.save(message);
    }

    /**
     * Create a system message for charter changes
     */
    async createCharterChangeMessage(groupId: string, changeDescription: string): Promise<Message> {
        return await this.createSystemMessage({
            text: `📜 Charter updated: ${changeDescription}`,
            groupId,
        });
    }

    /**
     * Get all messages for a group
     */
    async getGroupMessages(groupId: string): Promise<Message[]> {
        return await this.messageRepository.find({
            where: { group: { id: groupId } },
            relations: ['sender', 'group'],
            order: { createdAt: 'ASC' }
        });
    }

    /**
     * Get system messages for a group
     */
    async getGroupSystemMessages(groupId: string): Promise<Message[]> {
        return await this.messageRepository.find({
            where: { 
                group: { id: groupId },
                isSystemMessage: true 
            },
            relations: ['group'],
            order: { createdAt: 'ASC' }
        });
    }

    /**
     * Get message by ID
     */
    async getMessageById(id: string): Promise<Message | null> {
        return await this.messageRepository.findOne({
            where: { id },
            relations: ['sender', 'group']
        });
    }

    /**
     * Update a message
     */
    async updateMessage(id: string, messageData: Partial<Message>): Promise<Message | null> {
        await this.messageRepository.update(id, messageData);
        return await this.getMessageById(id);
    }

    /**
     * Delete a message
     */
    async deleteMessage(id: string): Promise<boolean> {
        const result = await this.messageRepository.delete(id);
        return result.affected ? result.affected > 0 : false;
    }

    /**
     * Archive a message
     */
    async archiveMessage(id: string): Promise<Message | null> {
        await this.messageRepository.update(id, { isArchived: true });
        return await this.getMessageById(id);
    }
} 