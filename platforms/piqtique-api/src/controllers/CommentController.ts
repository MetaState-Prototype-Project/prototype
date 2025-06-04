import { Request, Response } from "express";
import { AppDataSource } from "../database/data-source";
import { Comment } from "../database/entities/Comment";
import { Post } from "../database/entities/Post";

export class CommentController {
    private commentRepository = AppDataSource.getRepository(Comment);
    private postRepository = AppDataSource.getRepository(Post);

    createComment = async (req: Request, res: Response) => {
        try {
            const { postId, text } = req.body;
            const userId = req.user?.id;

            if (!userId) {
                return res.status(401).json({ error: "Unauthorized" });
            }

            const post = await this.postRepository.findOneBy({ id: postId });
            if (!post) {
                return res.status(404).json({ error: "Post not found" });
            }

            const comment = this.commentRepository.create({
                text,
                author: { id: userId },
                post: { id: postId }
            });

            const savedComment = await this.commentRepository.save(comment);
            res.status(201).json(savedComment);
        } catch (error) {
            console.error("Error creating comment:", error);
            res.status(500).json({ error: "Internal server error" });
        }
    };

    getPostComments = async (req: Request, res: Response) => {
        try {
            const { postId } = req.params;
            const page = parseInt(req.query.page as string) || 1;
            const limit = parseInt(req.query.limit as string) || 10;

            const [comments, total] = await this.commentRepository.findAndCount({
                where: { post: { id: postId } },
                relations: ["author"],
                order: { createdAt: "DESC" },
                skip: (page - 1) * limit,
                take: limit
            });

            res.json({
                comments,
                total,
                page,
                totalPages: Math.ceil(total / limit)
            });
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

            const comment = await this.commentRepository.findOne({
                where: { id },
                relations: ["author"]
            });

            if (!comment) {
                return res.status(404).json({ error: "Comment not found" });
            }

            if (comment.author.id !== userId) {
                return res.status(403).json({ error: "Forbidden" });
            }

            comment.text = text;
            const updatedComment = await this.commentRepository.save(comment);
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

            const comment = await this.commentRepository.findOne({
                where: { id },
                relations: ["author"]
            });

            if (!comment) {
                return res.status(404).json({ error: "Comment not found" });
            }

            if (comment.author.id !== userId) {
                return res.status(403).json({ error: "Forbidden" });
            }

            await this.commentRepository.softDelete(id);
            res.status(204).send();
        } catch (error) {
            console.error("Error deleting comment:", error);
            res.status(500).json({ error: "Internal server error" });
        }
    };
} 