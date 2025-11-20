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
        voteId?: string;
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
            voteId: messageData.voteId,
        });

        return await this.messageRepository.save(message);
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
            order: { createdAt: "DESC" }
        });
    }
}

