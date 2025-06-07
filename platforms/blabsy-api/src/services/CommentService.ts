import { AppDataSource } from "../database/data-source";
import { Reply } from "../database/entities/Reply";
import { Blab } from "../database/entities/Blab";

export class CommentService {
    private replyRepository = AppDataSource.getRepository(Reply);
    private blabRepository = AppDataSource.getRepository(Blab);

    async createComment(blabId: string, authorId: string, text: string): Promise<Reply> {
        const blab = await this.blabRepository.findOneBy({ id: blabId });
        if (!blab) {
            throw new Error('Blab not found');
        }

        const reply = this.replyRepository.create({
            text,
            creator: { id: authorId },
            blab: { id: blabId }
        });

        return await this.replyRepository.save(reply);
    }

    async getPostComments(blabId: string): Promise<Reply[]> {
        return await this.replyRepository.find({
            where: { blab: { id: blabId } },
            relations: ['creator'],
            order: { createdAt: 'DESC' }
        });
    }

    async getCommentById(id: string): Promise<Reply | null> {
        return await this.replyRepository.findOne({
            where: { id },
            relations: ['creator']
        });
    }

    async updateComment(id: string, text: string): Promise<Reply> {
        const reply = await this.getCommentById(id);
        if (!reply) {
            throw new Error('Reply not found');
        }

        reply.text = text;
        return await this.replyRepository.save(reply);
    }

    async deleteComment(id: string): Promise<void> {
        const reply = await this.getCommentById(id);
        if (!reply) {
            throw new Error('Reply not found');
        }

        await this.replyRepository.softDelete(id);
    }
} 