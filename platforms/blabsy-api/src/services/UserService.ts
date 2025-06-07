import { AppDataSource } from "../database/data-source";
import { User } from "../database/entities/User";
import { Blab } from "../database/entities/Blab";
import { signToken } from "../utils/jwt";
import { Like } from "typeorm";

export class UserService {
    private userRepository = AppDataSource.getRepository(User);
    private blabRepository = AppDataSource.getRepository(Blab);

    async createBlankUser(ename: string): Promise<User> {
        const user = this.userRepository.create({
            ename,
            isVerified: false,
            isPrivate: false,
            isArchived: false,
        });

        return await this.userRepository.save(user);
    }

    async findOrCreateUser(ename: string): Promise<{ user: User; token: string }> {
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
        const searchQuery = query.toLowerCase();

        return this.userRepository.find({
            where: [
                { username: Like(`%${searchQuery}%`) },
                { ename: Like(`%${searchQuery}%`) },
            ],
            select: {
                id: true,
                username: true,
                displayName: true,
                bio: true,
                profilePictureUrl: true,
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
                username: true,
                displayName: true,
                profilePictureUrl: true,
                followers: true,
                following: true,
                bio: true,
            },
        });

        if (!user) return null;

        const blabs = await this.blabRepository.find({
            where: { author: { id: userId } },
            relations: ["author"],
            order: { createdAt: "DESC" },
        });

        return {
            ...user,
            totalBlabs: blabs.length,
            blabs: blabs.map((blab) => ({
                id: blab.id,
                avatar: blab.author.profilePictureUrl,
                userId: blab.author.id,
                username: blab.author.username,
                imgUris: blab.images,
                caption: blab.content,
                time: blab.createdAt,
                count: {
                    likes: blab.likedBy,
                    replies: blab.replies,
                },
            })),
        };
    }

    async updateProfile(userId: string, data: { username?: string; profilePictureUrl?: string; displayName?: string }): Promise<User> {
        const user = await this.userRepository.findOneBy({ id: userId });
        if (!user) {
            throw new Error("User not found");
        }

        if (data.username !== undefined) user.username = data.username;
        if (data.profilePictureUrl !== undefined) user.profilePictureUrl = data.profilePictureUrl;
        if (data.displayName !== undefined) user.displayName = data.displayName;

        return await this.userRepository.save(user);
    }
}

