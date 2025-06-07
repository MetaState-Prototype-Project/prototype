import { AppDataSource } from "../database/data-source";
import { Post } from "../database/entities/Post";
import { User } from "../database/entities/User";
import { In } from "typeorm";

interface CreatePostData {
    text: string;
    images?: string[];
    hashtags?: string[];
}

export class PostService {
    private postRepository = AppDataSource.getRepository(Post);
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

        const [posts, total] = await this.postRepository.findAndCount({
            where: {
                author: { id: In(authorIds) },
                isArchived: false,
            },
            relations: ["author", "likedBy", "comments", "comments.author"],
            order: {
                createdAt: "DESC",
            },
            skip: (page - 1) * limit,
            take: limit,
        });

        return {
            posts,
            total,
            page,
            totalPages: Math.ceil(total / limit),
        };
    }

    async createPost(userId: string, data: CreatePostData) {
        const user = await this.userRepository.findOneBy({ id: userId });
        if (!user) {
            throw new Error("User not found");
        }

        const post = this.postRepository.create({
            author: user,
            text: data.text,
            images: data.images || [],
            hashtags: data.hashtags || [],
            likedBy: [],
        });

        return await this.postRepository.save(post);
    }

    async toggleLike(postId: string, userId: string): Promise<Post> {
        const post = await this.postRepository.findOne({
            where: { id: postId },
            relations: ["likedBy"],
        });

        if (!post) {
            throw new Error("Post not found");
        }

        const user = await this.userRepository.findOneBy({ id: userId });
        if (!user) {
            throw new Error("User not found");
        }

        const isLiked = post.likedBy.some((u) => u.id === userId);

        if (isLiked) {
            post.likedBy = post.likedBy.filter((u) => u.id !== userId);
        } else {
            post.likedBy.push(user);
        }

        return await this.postRepository.save(post);
    }
}
