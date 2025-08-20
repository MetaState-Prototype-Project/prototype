import { Request, Response } from "express";
import { MessageService } from "../services/MessageService";

export class MessageController {
    private messageService = new MessageService();

    async createMessage(req: Request, res: Response) {
        try {
            const userId = (req as any).user?.id;
            if (!userId) {
                return res.status(401).json({ error: "Unauthorized" });
            }

            const { text, groupId } = req.body;
            
            if (!text || !groupId) {
                return res.status(400).json({ error: "Text and groupId are required" });
            }

            const message = await this.messageService.createMessage({
                text,
                senderId: userId,
                groupId
            });

            const fullMessage = await this.messageService.getMessageById(message.id);
            res.status(201).json(fullMessage);
        } catch (error) {
            console.error("Error creating message:", error);
            res.status(500).json({ error: "Internal server error" });
        }
    }

    async getMessageById(req: Request, res: Response) {
        try {
            const { id } = req.params;
            const message = await this.messageService.getMessageById(id);
            
            if (!message) {
                return res.status(404).json({ error: "Message not found" });
            }

            res.json(message);
        } catch (error) {
            console.error("Error getting message by id:", error);
            res.status(500).json({ error: "Internal server error" });
        }
    }

    async getGroupMessages(req: Request, res: Response) {
        try {
            const { groupId } = req.params;
            const userId = (req as any).user?.id;
            
            if (!userId) {
                return res.status(401).json({ error: "Unauthorized" });
            }

            const messages = await this.messageService.getGroupMessages(groupId);
            res.json(messages);
        } catch (error) {
            console.error("Error getting group messages:", error);
            res.status(500).json({ error: "Internal server error" });
        }
    }

    async updateMessage(req: Request, res: Response) {
        try {
            const { id } = req.params;
            const userId = (req as any).user?.id;
            
            if (!userId) {
                return res.status(401).json({ error: "Unauthorized" });
            }

            const message = await this.messageService.getMessageById(id);
            if (!message) {
                return res.status(404).json({ error: "Message not found" });
            }

            // Check if user is the sender (system messages cannot be edited)
            if (!message.sender) {
                return res.status(403).json({ error: "Access denied - system messages cannot be edited" });
            }
            if (message.sender.id !== userId) {
                return res.status(403).json({ error: "Access denied - you can only edit your own messages" });
            }

            const { text } = req.body;
            const updatedMessage = await this.messageService.updateMessage(id, { text });
            
            if (!updatedMessage) {
                return res.status(404).json({ error: "Message not found" });
            }

            res.json(updatedMessage);
        } catch (error) {
            console.error("Error updating message:", error);
            res.status(500).json({ error: "Internal server error" });
        }
    }

    async deleteMessage(req: Request, res: Response) {
        try {
            const { id } = req.params;
            const userId = (req as any).user?.id;
            
            if (!userId) {
                return res.status(401).json({ error: "Unauthorized" });
            }

            const message = await this.messageService.getMessageById(id);
            if (!message) {
                return res.status(404).json({ error: "Message not found" });
            }

            // Check if user is the sender (system messages cannot be deleted)
            if (!message.sender) {
                return res.status(403).json({ error: "Access denied - system messages cannot be deleted" });
            }
            if (message.sender.id !== userId) {
                return res.status(403).json({ error: "Access denied - you can only delete your own messages" });
            }

            const success = await this.messageService.deleteMessage(id);
            
            if (!success) {
                return res.status(404).json({ error: "Message not found" });
            }

            res.json({ message: "Message deleted successfully" });
        } catch (error) {
            console.error("Error deleting message:", error);
            res.status(500).json({ error: "Internal server error" });
        }
    }

    async getUserMessages(req: Request, res: Response) {
        try {
            const userId = (req as any).user?.id;
            if (!userId) {
                return res.status(401).json({ error: "Unauthorized" });
            }

            const messages = await this.messageService.getUserMessages(userId);
            res.json(messages);
        } catch (error) {
            console.error("Error getting user messages:", error);
            res.status(500).json({ error: "Internal server error" });
        }
    }

    async archiveMessage(req: Request, res: Response) {
        try {
            const { id } = req.params;
            const userId = (req as any).user?.id;
            
            if (!userId) {
                return res.status(401).json({ error: "Unauthorized" });
            }

            const message = await this.messageService.getMessageById(id);
            if (!message) {
                return res.status(404).json({ error: "Message not found" });
            }

            // Check if user is the sender (system messages cannot be archived)
            if (!message.sender) {
                return res.status(403).json({ error: "Access denied - system messages cannot be archived" });
            }
            if (message.sender.id !== userId) {
                return res.status(403).json({ error: "Access denied - you can only archive your own messages" });
            }

            const archivedMessage = await this.messageService.archiveMessage(id);
            res.json(archivedMessage);
        } catch (error) {
            console.error("Error archiving message:", error);
            res.status(500).json({ error: "Internal server error" });
        }
    }
} 