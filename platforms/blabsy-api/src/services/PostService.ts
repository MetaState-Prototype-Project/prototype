import { AppDataSource } from "../database/data-source";
import { Blab } from "../database/entities/Blab";
import { User } from "../database/entities/User";
import { In } from "typeorm";

interface CreateBlabData {
    content: string;
    images?: string[];
    hashtags?: string[];
}

export class PostService {
    private blabRepository = AppDataSource.getRepository(Blab);
    private userRepository = AppDataSource.getRepository(User);

    async getFollowingFeed(userId: string, page: number, limit: number) {
        const user = await this.userRepository.findOne({
            where: { id: userId },
            relations: ["following"],
        });

        if (!user) {
            throw new Error("User not found");
        }

        const followingIds = user.following.map((f: User) => f.id);
        const authorIds = [...followingIds, userId];

        const [blabs, total] = await this.blabRepository.findAndCount({
            where: {
                author: { id: In(authorIds) },
                isArchived: false,
            },
            relations: ["author", "likedBy", "replies", "replies.creator"],
            order: {
                createdAt: "DESC",
            },
            skip: (page - 1) * limit,
            take: limit,
        });

        return {
            blabs,
            total,
            page,
            totalPages: Math.ceil(total / limit),
        };
    }

    async createPost(userId: string, data: CreateBlabData) {
        const user = await this.userRepository.findOneBy({ id: userId });
        if (!user) {
            throw new Error("User not found");
        }

        const blab = this.blabRepository.create({
            author: user,
            content: data.content,
            images: data.images || [],
            hashtags: data.hashtags || [],
            likedBy: [],
        });

        return await this.blabRepository.save(blab);
    }

    async toggleLike(blabId: string, userId: string): Promise<Blab> {
        const blab = await this.blabRepository.findOne({
            where: { id: blabId },
            relations: ["likedBy"],
        });

        if (!blab) {
            throw new Error("Blab not found");
        }

        const user = await this.userRepository.findOneBy({ id: userId });
        if (!user) {
            throw new Error("User not found");
        }

        const isLiked = blab.likedBy.some((u) => u.id === userId);

        if (isLiked) {
            blab.likedBy = blab.likedBy.filter((u) => u.id !== userId);
        } else {
            blab.likedBy.push(user);
        }

        return await this.blabRepository.save(blab);
    }
}
