import { Request, Response } from "express";
import { AppDataSource } from "../database/data-source";
import { Message } from "../database/entities/Message";
import { User } from "../database/entities/User";

export class MessageController {
    private messageRepository = AppDataSource.getRepository(Message);
    private userRepository = AppDataSource.getRepository(User);

    sendMessage = async (req: Request, res: Response) => {
        try {
            const { recipientId, text } = req.body;
            const userId = req.user?.id;

            if (!userId) {
                return res.status(401).json({ error: "Unauthorized" });
            }

            const recipient = await this.userRepository.findOneBy({ id: recipientId });
            if (!recipient) {
                return res.status(404).json({ error: "Recipient not found" });
            }

            const message = this.messageRepository.create({
                text,
                sender: { id: userId },
                recipient: { id: recipientId }
            });

            const savedMessage = await this.messageRepository.save(message);
            res.status(201).json(savedMessage);
        } catch (error) {
            console.error("Error sending message:", error);
            res.status(500).json({ error: "Internal server error" });
        }
    };

    getConversation = async (req: Request, res: Response) => {
        try {
            const { userId } = req.params;
            const currentUserId = req.user?.id;
            const page = parseInt(req.query.page as string) || 1;
            const limit = parseInt(req.query.limit as string) || 20;

            if (!currentUserId) {
                return res.status(401).json({ error: "Unauthorized" });
            }

            const [messages, total] = await this.messageRepository.findAndCount({
                where: [
                    { sender: { id: currentUserId }, recipient: { id: userId } },
                    { sender: { id: userId }, recipient: { id: currentUserId } }
                ],
                relations: ["sender", "recipient"],
                order: { createdAt: "DESC" },
                skip: (page - 1) * limit,
                take: limit
            });

            // Mark unread messages as read
            await this.messageRepository.update(
                {
                    sender: { id: userId },
                    recipient: { id: currentUserId },
                    isRead: false
                },
                { isRead: true }
            );

            res.json({
                messages,
                total,
                page,
                totalPages: Math.ceil(total / limit)
            });
        } catch (error) {
            console.error("Error fetching conversation:", error);
            res.status(500).json({ error: "Internal server error" });
        }
    };

    getConversations = async (req: Request, res: Response) => {
        try {
            const userId = req.user?.id;
            const page = parseInt(req.query.page as string) || 1;
            const limit = parseInt(req.query.limit as string) || 10;

            if (!userId) {
                return res.status(401).json({ error: "Unauthorized" });
            }

            // Get the latest message from each conversation
            const conversations = await this.messageRepository
                .createQueryBuilder("message")
                .leftJoinAndSelect("message.sender", "sender")
                .leftJoinAndSelect("message.recipient", "recipient")
                .where("message.sender.id = :userId OR message.recipient.id = :userId", { userId })
                .andWhere("message.isArchived = false")
                .orderBy("message.createdAt", "DESC")
                .getMany();

            // Group messages by conversation partner
            const conversationMap = new Map();
            conversations.forEach(message => {
                const partnerId = message.sender.id === userId ? message.recipient.id : message.sender.id;
                if (!conversationMap.has(partnerId)) {
                    conversationMap.set(partnerId, {
                        partner: message.sender.id === userId ? message.recipient : message.sender,
                        lastMessage: message,
                        unreadCount: 0
                    });
                }
            });

            // Count unread messages for each conversation
            for (const [partnerId, conversation] of conversationMap) {
                const unreadCount = await this.messageRepository.count({
                    where: {
                        sender: { id: partnerId },
                        recipient: { id: userId },
                        isRead: false
                    }
                });
                conversation.unreadCount = unreadCount;
            }

            const conversationList = Array.from(conversationMap.values());
            const start = (page - 1) * limit;
            const end = start + limit;
            const paginatedConversations = conversationList.slice(start, end);

            res.json({
                conversations: paginatedConversations,
                total: conversationList.length,
                page,
                totalPages: Math.ceil(conversationList.length / limit)
            });
        } catch (error) {
            console.error("Error fetching conversations:", error);
            res.status(500).json({ error: "Internal server error" });
        }
    };

    deleteMessage = async (req: Request, res: Response) => {
        try {
            const { id } = req.params;
            const userId = req.user?.id;

            if (!userId) {
                return res.status(401).json({ error: "Unauthorized" });
            }

            const message = await this.messageRepository.findOne({
                where: { id },
                relations: ["sender"]
            });

            if (!message) {
                return res.status(404).json({ error: "Message not found" });
            }

            if (message.sender.id !== userId) {
                return res.status(403).json({ error: "Forbidden" });
            }

            await this.messageRepository.softDelete(id);
            res.status(204).send();
        } catch (error) {
            console.error("Error deleting message:", error);
            res.status(500).json({ error: "Internal server error" });
        }
    };
} 