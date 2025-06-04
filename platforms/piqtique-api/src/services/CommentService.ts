import { AppDataSource } from "../database/data-source";
import { Comment } from "../database/entities/Comment";
import { Post } from "../database/entities/Post";

export class CommentService {
    private commentRepository = AppDataSource.getRepository(Comment);
    private postRepository = AppDataSource.getRepository(Post);

    async createComment(postId: string, authorId: string, text: string): Promise<Comment> {
        const post = await this.postRepository.findOneBy({ id: postId });
        if (!post) {
            throw new Error('Post not found');
        }

        const comment = this.commentRepository.create({
            text,
            author: { id: authorId },
            post: { id: postId }
        });

        return await this.commentRepository.save(comment);
    }

    async getPostComments(postId: string): Promise<Comment[]> {
        return await this.commentRepository.find({
            where: { post: { id: postId } },
            relations: ['author'],
            order: { createdAt: 'DESC' }
        });
    }

    async getCommentById(id: string): Promise<Comment | null> {
        return await this.commentRepository.findOne({
            where: { id },
            relations: ['author']
        });
    }

    async updateComment(id: string, text: string): Promise<Comment> {
        const comment = await this.getCommentById(id);
        if (!comment) {
            throw new Error('Comment not found');
        }

        comment.text = text;
        return await this.commentRepository.save(comment);
    }

    async deleteComment(id: string): Promise<void> {
        const comment = await this.getCommentById(id);
        if (!comment) {
            throw new Error('Comment not found');
        }

        await this.commentRepository.softDelete(id);
    }
} 