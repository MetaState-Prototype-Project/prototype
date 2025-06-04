import { AppDataSource } from "../database/data-source";
import { User } from "../database/entities/User";
import { signToken } from "../utils/jwt";
import { Like } from "typeorm";

export class UserService {
    private userRepository = AppDataSource.getRepository(User);

    async createBlankUser(ename: string): Promise<User> {
        const user = this.userRepository.create({
            ename,
            isVerified: false,
            isPrivate: false,
            isArchived: false
        });

        return await this.userRepository.save(user);
    }

    async findOrCreateUser(ename: string): Promise<{ user: User; token: string }> {
        let user = await this.userRepository.findOne({
            where: { ename }
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
                { handle: Like(`%${searchQuery}%`) },
                { ename: Like(`%${searchQuery}%`) }
            ],
            select: {
                id: true,
                handle: true,
                name: true,
                description: true,
                avatarUrl: true,
                isVerified: true
            },
            take: 10
        });
    };

    followUser = async (followerId: string, followingId: string) => {
        const follower = await this.userRepository.findOne({
            where: { id: followerId },
            relations: ['following']
        });

        const following = await this.userRepository.findOne({
            where: { id: followingId }
        });

        if (!follower || !following) {
            throw new Error('User not found');
        }

        if (!follower.following) {
            follower.following = [];
        }

        // Check if already following
        if (follower.following.some(user => user.id === followingId)) {
            return follower;
        }

        follower.following.push(following);
        return await this.userRepository.save(follower);
    };
} 