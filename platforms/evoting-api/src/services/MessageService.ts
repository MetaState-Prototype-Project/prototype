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
        voteId?: string; // Added voteId to the type
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
            voteId: messageData.voteId, // Include the vote ID if provided
        });

        return await this.messageRepository.save(message);
    }

    /**
     * Create a system message for vote creation
     */
        async createVoteCreatedMessage(groupId: string, voteTitle: string, voteId: string, creatorName: string, deadline?: Date | null): Promise<Message> {
        const deadlineText = deadline
            ? `\nDeadline: ${deadline.toLocaleDateString()} at ${deadline.toLocaleTimeString()}`
            : '\nNo deadline set';

        const voteUrl = `${process.env.PUBLIC_EVOTING_URL || 'http://localhost:3000'}/${voteId}`;
        return await this.createSystemMessage({
            text: `eVoting Platform: New vote created!\n\n"${voteTitle}"\n\nVote ID: ${voteId}\n\nCreated by: ${creatorName}${deadlineText}\n\n<a href="${voteUrl}">Cast your vote here</a>`,
            groupId,
            voteId,
        });
    }

    /**
     * Create a system message for vote deadline crossing
     */
        async createVoteDeadlineMessage(groupId: string, voteTitle: string, voteId: string, creatorName: string, deadline: Date): Promise<Message> {
        const deadlineText = `\nOriginal Deadline: ${deadline.toLocaleDateString()} at ${deadline.toLocaleTimeString()}`;

        return await this.createSystemMessage({
            text: `eVoting Platform: Vote deadline passed!\n\n"${voteTitle}"\n\nVote ID: ${voteId}\n\nCreated by: ${creatorName}${deadlineText}\n\nThis vote has ended. Check the results!`,
            groupId,
            voteId,
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