import { AppDataSource } from "../database/data-source";
import { User } from "../database/entities/User";
import { Post } from "../database/entities/Post";
import { signToken } from "../utils/jwt";
import { Like, Raw } from "typeorm";

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

    searchUsers = async (
        query: string, 
        page: number = 1, 
        limit: number = 10, 
        verifiedOnly: boolean = false,
        sortBy: string = "relevance"
    ) => {
        // Sanitize and trim the search query
        const searchQuery = query.trim();
        
        // Return empty array if query is too short or empty
        if (searchQuery.length < 2) {
            return [];
        }

        // Validate pagination parameters
        if (page < 1 || limit < 1 || limit > 100) {
            return [];
        }

        // Use query builder for more complex queries
        const queryBuilder = this.userRepository
            .createQueryBuilder("user")
            .select([
                "user.id",
                "user.handle",
                "user.name", 
                "user.description",
                "user.avatarUrl",
                "user.isVerified"
            ])
            .where(
                "user.name ILIKE :query OR user.ename ILIKE :query OR user.handle ILIKE :query OR user.description ILIKE :query OR user.name ILIKE :fuzzyQuery OR user.ename ILIKE :fuzzyQuery OR user.handle ILIKE :fuzzyQuery",
                { 
                    query: `%${searchQuery}%`,
                    fuzzyQuery: `%${searchQuery.split('').join('%')}%` // Fuzzy search with wildcards between characters
                }
            );

        // Add verified filter if requested
        if (verifiedOnly) {
            queryBuilder.andWhere("user.isVerified = :verified", { verified: true });
        }

        // Add additional filters for better results
        queryBuilder.andWhere("user.isArchived = :archived", { archived: false });

        // Apply sorting based on sortBy parameter
        switch (sortBy) {
            case "name":
                queryBuilder.orderBy("user.name", "ASC");
                break;
            case "verified":
                queryBuilder.orderBy("user.isVerified", "DESC").addOrderBy("user.name", "ASC");
                break;
            case "newest":
                queryBuilder.orderBy("user.createdAt", "DESC");
                break;
            case "relevance":
            default:
                // Default relevance sorting: verified first, then by name
                queryBuilder.orderBy("user.isVerified", "DESC").addOrderBy("user.name", "ASC");
                break;
        }

        return queryBuilder
            .skip((page - 1) * limit)
            .take(limit)
            .getMany();
    };

    getSearchUsersCount = async (
        query: string,
        verifiedOnly: boolean = false
    ) => {
        // Sanitize and trim the search query
        const searchQuery = query.trim();
        
        // Return 0 if query is too short or empty
        if (searchQuery.length < 2) {
            return 0;
        }

        // Use query builder for count
        const queryBuilder = this.userRepository
            .createQueryBuilder("user")
            .where(
                "user.name ILIKE :query OR user.ename ILIKE :query OR user.handle ILIKE :query OR user.description ILIKE :query OR user.name ILIKE :fuzzyQuery OR user.ename ILIKE :fuzzyQuery OR user.handle ILIKE :fuzzyQuery",
                { 
                    query: `%${searchQuery}%`,
                    fuzzyQuery: `%${searchQuery.split('').join('%')}%` // Fuzzy search with wildcards between characters
                }
            );

        // Add verified filter if requested
        if (verifiedOnly) {
            queryBuilder.andWhere("user.isVerified = :verified", { verified: true });
        }

        // Add additional filters for consistency
        queryBuilder.andWhere("user.isArchived = :archived", { archived: false });

        return queryBuilder.getCount();
    };

    getSearchSuggestions = async (query: string, limit: number = 5) => {
        // Sanitize and trim the search query
        const searchQuery = query.trim();
        
        // Return empty array if query is too short
        if (searchQuery.length < 1) {
            return [];
        }

        // Use query builder for suggestions
        const queryBuilder = this.userRepository
            .createQueryBuilder("user")
            .select([
                "user.id",
                "user.handle",
                "user.name",
                "user.ename"
            ])
            .where(
                "user.name ILIKE :query OR user.ename ILIKE :query OR user.handle ILIKE :query",
                { query: `%${searchQuery}%` }
            )
            .andWhere("user.isArchived = :archived", { archived: false })
            .orderBy("user.isVerified", "DESC")
            .addOrderBy("user.name", "ASC")
            .take(limit);

        return queryBuilder.getMany();
    };

    getPopularSearches = async (limit: number = 10) => {
        // This could be enhanced with actual search analytics in the future
        // For now, return some sample popular searches based on verified users
        return this.userRepository
            .createQueryBuilder("user")
            .select([
                "user.id",
                "user.handle",
                "user.name",
                "user.ename"
            ])
            .where("user.isVerified = :verified", { verified: true })
            .andWhere("user.isArchived = :archived", { archived: false })
            .andWhere("user.name IS NOT NULL")
            .orderBy("user.name", "ASC")
            .take(limit)
            .getMany();
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
