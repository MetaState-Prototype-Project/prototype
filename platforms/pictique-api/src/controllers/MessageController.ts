import { Request, Response } from "express";
import { ChatService } from "../services/ChatService";
import { verifyToken } from "../utils/jwt";
import { AppDataSource } from "../database/data-source";
import { User } from "../database/entities/User";

export class MessageController {
    private chatService = new ChatService();

    // Chat Operations
    createChat = async (req: Request, res: Response) => {
        try {
            const { name, participantIds } = req.body;
            const userId = req.user?.id;

            if (!userId) {
                return res.status(401).json({ error: "Unauthorized" });
            }

            // Ensure the creator is included in participants
            const allParticipants = [
                ...new Set([userId, ...(participantIds || [])]),
            ];

            // Only check for duplicates if it's a direct message (2 participants, no name)
            // Allow multiple groups with the same members
            if (allParticipants.length === 2 && !name) {
                const existingChat = await this.chatService.findChatByParticipants(allParticipants);
                if (existingChat) {
                    return res.status(200).json(existingChat);
                }
            }

            const chat = await this.chatService.createChat(
                name,
                allParticipants
            );
            res.status(201).json(chat);
        } catch (error) {
            console.error("Error creating chat:", error);
            res.status(500).json({ error: "Internal server error" });
        }
    };

    getChat = async (req: Request, res: Response) => {
        try {
            const { chatId } = req.params;
            const userId = req.user?.id;
            const page = parseInt(req.query.page as string) || 1;
            const limit = parseInt(req.query.limit as string) || 20;

            if (!userId) {
                return res.status(401).json({ error: "Unauthorized" });
            }

            const chat = await this.chatService.getChatById(chatId);
            if (!chat) {
                return res.status(404).json({ error: "Chat not found" });
            }

            // Verify user is a participant
            if (!chat.participants.some((p) => p.id === userId)) {
                return res
                    .status(403)
                    .json({ error: "Not a participant in this chat" });
            }

            // Get messages for the chat
            const messages = await this.chatService.getChatMessages(
                chatId,
                userId,
                page,
                limit
            );

            res.json({
                ...chat,
                messages: messages.messages,
                messagesTotal: messages.total,
                messagesPage: messages.page,
                messagesTotalPages: messages.totalPages,
            });
        } catch (error) {
            console.error("Error fetching chat:", error);
            res.status(500).json({ error: "Internal server error" });
        }
    };

    getUserChats = async (req: Request, res: Response) => {
        try {
            const userId = req.user?.id;
            const page = parseInt(req.query.page as string) || 1;
            const limit = parseInt(req.query.limit as string) || 10;

            if (!userId) {
                return res.status(401).json({ error: "Unauthorized" });
            }

            const result = await this.chatService.getUserChats(
                userId,
                page,
                limit
            );

            // Transform the response to include only necessary data
            const transformedChats = result.chats.map((chat) => ({
                id: chat.id,
                name: chat.name,
                participants: chat.participants.map((p) => ({
                    id: p.id,
                    handle: p.handle,
                    name: p.name,
                    avatarUrl: p.avatarUrl,
                })),
                latestMessage: chat.latestMessage,
                updatedAt: chat.updatedAt,
            }));

            res.json({
                ...result,
                chats: transformedChats,
            });
        } catch (error) {
            console.error("Error fetching user chats:", error);
            res.status(500).json({ error: "Internal server error" });
        }
    };

    // Chat Participant Operations
    addParticipants = async (req: Request, res: Response) => {
        try {
            const { chatId } = req.params;
            const { participantIds } = req.body;
            const userId = req.user?.id;

            if (!userId) {
                return res.status(401).json({ error: "Unauthorized" });
            }

            const chat = await this.chatService.addParticipants(
                chatId,
                participantIds
            );
            res.json(chat);
        } catch (error) {
            console.error("Error adding participants:", error);
            res.status(500).json({ error: "Internal server error" });
        }
    };

    removeParticipant = async (req: Request, res: Response) => {
        try {
            const { chatId, userId } = req.params;
            const currentUserId = req.user?.id;

            if (!currentUserId) {
                return res.status(401).json({ error: "Unauthorized" });
            }

            const chat = await this.chatService.removeParticipant(
                chatId,
                userId
            );
            res.json(chat);
        } catch (error) {
            console.error("Error removing participant:", error);
            res.status(500).json({ error: "Internal server error" });
        }
    };

    // Message Operations (as sub-resources of Chat)
    createMessage = async (req: Request, res: Response) => {
        try {
            const { chatId } = req.params;
            const { text } = req.body;
            const userId = req.user?.id;

            if (!userId) {
                return res.status(401).json({ error: "Unauthorized" });
            }

            const message = await this.chatService.sendMessage(
                chatId,
                userId,
                text
            );
            res.status(201).json(message);
        } catch (error) {
            console.error("Error sending message:", error);
            res.status(500).json({ error: "Internal server error" });
        }
    };

    getMessages = async (req: Request, res: Response) => {
        try {
            const { chatId } = req.params;
            const userId = req.user?.id;
            const page = parseInt(req.query.page as string) || 1;
            const limit = parseInt(req.query.limit as string) || 20;

            if (!userId) {
                return res.status(401).json({ error: "Unauthorized" });
            }

            const result = await this.chatService.getChatMessages(
                chatId,
                userId,
                page,
                limit
            );
            res.json(result);
        } catch (error) {
            console.error("Error fetching messages:", error);
            res.status(500).json({ error: "Internal server error" });
        }
    };

    markAsRead = async (req: Request, res: Response) => {
        try {
            const { chatId } = req.params;
            const userId = req.user?.id;

            if (!userId) {
                return res.status(401).json({ error: "Unauthorized" });
            }

            await this.chatService.markMessagesAsRead(chatId, userId);
            res.status(204).send();
        } catch (error) {
            console.error("Error marking messages as read:", error);
            res.status(500).json({ error: "Internal server error" });
        }
    };

    deleteMessage = async (req: Request, res: Response) => {
        try {
            const { chatId, messageId } = req.params;
            const userId = req.user?.id;

            if (!userId) {
                return res.status(401).json({ error: "Unauthorized" });
            }

            await this.chatService.deleteMessage(messageId, userId);
            res.status(204).send();
        } catch (error) {
            console.error("Error deleting message:", error);
            res.status(500).json({ error: "Internal server error" });
        }
    };

    getUnreadCount = async (req: Request, res: Response) => {
        try {
            const { chatId } = req.params;
            const userId = req.user?.id;

            if (!userId) {
                return res.status(401).json({ error: "Unauthorized" });
            }

            const count = await this.chatService.getUnreadMessageCount(
                chatId,
                userId
            );
            res.json({ count });
        } catch (error) {
            console.error("Error getting unread count:", error);
            res.status(500).json({ error: "Internal server error" });
        }
    };

    // SSE route for chat events
    getChatEvents = async (req: Request, res: Response) => {
        try {
            const { chatId } = req.params;
            const token = req.query.token;
            if (!token)
                return res.status(400).json({ error: "token is required" });

            const decoded = verifyToken(token as string) as { userId: string };

            if (!decoded?.userId) {
                return res.status(401).json({ error: "Invalid token" });
            }

            const userRepository = AppDataSource.getRepository(User);
            const user = await userRepository.findOneBy({ id: decoded.userId });
            if (!user) return res.status(401).json({ error: "Invalid token" });
            const userId = user.id;

            // Verify user is a participant
            const chat = await this.chatService.getChatById(chatId);
            if (!chat) {
                return res.status(404).json({ error: "Chat not found" });
            }

            if (!chat.participants.some((p) => p.id === userId)) {
                return res
                    .status(403)
                    .json({ error: "Not a participant in this chat" });
            }

            // Set SSE headers
            res.writeHead(200, {
                "Content-Type": "text/event-stream",
                "Cache-Control": "no-cache",
                Connection: "keep-alive",
            });

            const page = parseInt(req.query.page as string) || 1;
            const limit = parseInt(req.query.limit as string) || 2000;

            if (!userId) {
                return res.status(401).json({ error: "Unauthorized" });
            }

            // Get messages for the chat
            const messages = await this.chatService.getChatMessages(
                chatId,
                userId,
                page,
                limit
            );

            // Send initial connection message
            res.write(`data: ${JSON.stringify(messages.messages)}\n\n`);

            // Create event listener for this chat
            const eventEmitter = this.chatService.getEventEmitter();
            const eventName = `chat:${chatId}`;
            console.log("listening for", eventName);

            const messageHandler = (data: any) => {
                console.log("received event to send", data);
                res.write(`data: ${JSON.stringify(data)}\n\n`);
            };

            // Add event listener
            eventEmitter.on(eventName, messageHandler);

            // Handle client disconnect
            req.on("close", () => {
                eventEmitter.off(eventName, messageHandler);
                res.end();
            });
        } catch (error) {
            console.error("Error setting up chat events:", error);
            res.status(500).json({ error: "Internal server error" });
        }
    };
}
