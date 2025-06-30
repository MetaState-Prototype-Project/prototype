import { AppDataSource } from "../database/data-source";
import { User } from "../database/entities/User";
import { Post } from "../database/entities/Post";
import { signToken } from "../utils/jwt";
import { Like } from "typeorm";

export class UserService {
    userRepository = AppDataSource.getRepository(User);
    private postRepository = AppDataSource.getRepository(Post);

    async createBlankUser(ename: string): Promise<User> {
        const user = this.userRepository.create({
            ename,
            isVerified: false,
            isPrivate: false,
            isArchived: false,
        });

        return await this.userRepository.save(user);
    }

    async findOrCreateUser(
        ename: string
    ): Promise<{ user: User; token: string }> {
        let user = await this.userRepository.findOne({
            where: { ename },
        });

        if (!user) {
            user = await this.createBlankUser(ename);
        }

        const token = signToken({ userId: user.id });
        return { user, token };
    }

    async findById(id: string): Promise<User | null> {
        return await this.userRepository.findOneBy({ id });
    }

    searchUsers = async (query: string) => {
        const searchQuery = query;

        return this.userRepository.find({
            where: [
                { name: Like(`%${searchQuery}%`) },
                { ename: Like(`%${searchQuery}%`) },
            ],
            select: {
                id: true,
                handle: true,
                name: true,
                description: true,
                avatarUrl: true,
                isVerified: true,
            },
            take: 10,
        });
    };

    followUser = async (followerId: string, followingId: string) => {
        const follower = await this.userRepository.findOne({
            where: { id: followerId },
            relations: ["following"],
        });

        const following = await this.userRepository.findOne({
            where: { id: followingId },
        });

        if (!follower || !following) {
            throw new Error("User not found");
        }

        if (!follower.following) {
            follower.following = [];
        }

        // Check if already following
        if (follower.following.some((user) => user.id === followingId)) {
            return follower;
        }

        follower.following.push(following);
        return await this.userRepository.save(follower);
    };

    async getProfileById(userId: string) {
        const user = await this.userRepository.findOne({
            where: { id: userId },
            select: {
                id: true,
                handle: true,
                name: true,
                avatarUrl: true,
                followers: true,
                following: true,
                description: true,
            },
        });

        if (!user) return null;

        const posts = await this.postRepository.find({
            where: { author: { id: userId } },
            relations: ["author"],
            order: { createdAt: "DESC" },
        });

        return {
            ...user,
            totalPosts: posts.length,
            posts: posts.map((post) => ({
                id: post.id,
                avatar: post.author.avatarUrl,
                userId: post.author.id,
                username: post.author.handle,
                imgUris: post.images,
                caption: post.text,
                time: post.createdAt,
                count: {
                    likes: post.likedBy,
                    comments: post.comments,
                },
            })),
        };
    }

    async updateProfile(
        userId: string,
        data: { handle?: string; avatarUrl?: string; name?: string }
    ): Promise<User> {
        const user = await this.userRepository.findOneBy({ id: userId });
        if (!user) {
            throw new Error("User not found");
        }

        // Update only the fields that are provided
        if (data.handle !== undefined) user.handle = data.handle;
        if (data.avatarUrl !== undefined) user.avatarUrl = data.avatarUrl;
        if (data.name !== undefined) user.name = data.name;

        return await this.userRepository.save(user);
    }
}
