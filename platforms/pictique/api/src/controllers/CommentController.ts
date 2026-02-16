import { Request, Response } from "express";
import { CommentService } from "../services/CommentService";

export class CommentController {
    private commentService: CommentService;

    constructor() {
        this.commentService = new CommentService();
    }

    createComment = async (req: Request, res: Response) => {
        try {
            const { postId, text } = req.body;
            const userId = req.user?.id;

            if (!userId) {
                return res.status(401).json({ error: "Unauthorized" });
            }

            const comment = await this.commentService.createComment(postId, userId, text);
            res.status(201).json(comment);
        } catch (error) {
            console.error("Error creating comment:", error);
            res.status(500).json({ error: "Internal server error" });
        }
    };

    getPostComments = async (req: Request, res: Response) => {
        try {
            const { postId } = req.params;
            const comments = await this.commentService.getPostComments(postId);
            res.json(comments);
        } catch (error) {
            console.error("Error fetching comments:", error);
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

            const comment = await this.commentService.getCommentById(id);

            if (!comment) {
                return res.status(404).json({ error: "Comment not found" });
            }

            if (comment.author.id !== userId) {
                return res.status(403).json({ error: "Forbidden" });
            }

            const updatedComment = await this.commentService.updateComment(id, text);
            res.json(updatedComment);
        } catch (error) {
            console.error("Error updating comment:", error);
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

            const comment = await this.commentService.getCommentById(id);

            if (!comment) {
                return res.status(404).json({ error: "Comment not found" });
            }

            if (comment.author.id !== userId) {
                return res.status(403).json({ error: "Forbidden" });
            }

            await this.commentService.deleteComment(id);
            res.status(204).send();
        } catch (error) {
            console.error("Error deleting comment:", error);
            res.status(500).json({ error: "Internal server error" });
        }
    };
} 