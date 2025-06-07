import { Request, Response } from "express";
import { CommentService } from "../services/CommentService";

export class CommentController {
    private commentService: CommentService;

    constructor() {
        this.commentService = new CommentService();
    }

    createComment = async (req: Request, res: Response) => {
        try {
            const { blabId, text } = req.body;
            const userId = req.user?.id;

            if (!userId) {
                return res.status(401).json({ error: "Unauthorized" });
            }

            const reply = await this.commentService.createComment(blabId, userId, text);
            res.status(201).json(reply);
        } catch (error) {
            console.error("Error creating reply:", error);
            res.status(500).json({ error: "Internal server error" });
        }
    };

    getPostComments = async (req: Request, res: Response) => {
        try {
            const { blabId } = req.params;
            const replies = await this.commentService.getPostComments(blabId);
            res.json(replies);
        } catch (error) {
            console.error("Error fetching replies:", error);
            res.status(500).json({ error: "Internal server error" });
        }
    };

    updateComment = async (req: Request, res: Response) => {
        try {
            const { id } = req.params;
            const { text } = req.body;
            const userId = req.user?.id;

            if (!userId) {
                return res.status(401).json({ error: "Unauthorized" });
            }

            const reply = await this.commentService.getCommentById(id);

            if (!reply) {
                return res.status(404).json({ error: "Reply not found" });
            }

            if (reply.creator.id !== userId) {
                return res.status(403).json({ error: "Forbidden" });
            }

            const updatedReply = await this.commentService.updateComment(id, text);
            res.json(updatedReply);
        } catch (error) {
            console.error("Error updating reply:", error);
            res.status(500).json({ error: "Internal server error" });
        }
    };

    deleteComment = async (req: Request, res: Response) => {
        try {
            const { id } = req.params;
            const userId = req.user?.id;

            if (!userId) {
                return res.status(401).json({ error: "Unauthorized" });
            }

            const reply = await this.commentService.getCommentById(id);

            if (!reply) {
                return res.status(404).json({ error: "Reply not found" });
            }

            if (reply.creator.id !== userId) {
                return res.status(403).json({ error: "Forbidden" });
            }

            await this.commentService.deleteComment(id);
            res.status(204).send();
        } catch (error) {
            console.error("Error deleting reply:", error);
            res.status(500).json({ error: "Internal server error" });
        }
    };
} 