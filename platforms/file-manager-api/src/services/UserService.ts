import { AppDataSource } from "../database/data-source";
import { User } from "../database/entities/User";
import { signToken } from "../utils/jwt";

export class UserService {
    userRepository = AppDataSource.getRepository(User);

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

    async findByEname(ename: string): Promise<User | null> {
        const normalizedEname = ename.startsWith('@') ? ename.slice(1) : ename;
        const enameWithAt = `@${normalizedEname}`;
        
        const user = await this.userRepository
            .createQueryBuilder("user")
            .where("user.ename = :enameWithAt OR user.ename = :enameWithoutAt", {
                enameWithAt,
                enameWithoutAt: normalizedEname,
            })
            .getOne();
        
        return user;
    }

    async findUser(ename: string): Promise<User | null> {
        return this.findByEname(ename);
    }

    async getUserById(id: string): Promise<User | null> {
        return await this.findById(id);
    }

    searchUsers = async (
        query: string, 
        page: number = 1, 
        limit: number = 10, 
        verifiedOnly: boolean = false,
        sortBy: string = "relevance"
    ) => {
        const searchQuery = query.trim();
        
        if (searchQuery.length < 2) {
            return [];
        }

        if (page < 1 || limit < 1 || limit > 100) {
            return [];
        }

        const queryBuilder = this.userRepository
            .createQueryBuilder("user")
            .select([
                "user.id",
                "user.handle",
                "user.name", 
                "user.ename",
                "user.description",
                "user.avatarUrl",
                "user.isVerified"
            ])
            .addSelect(`
                CASE 
                    WHEN user.ename ILIKE :exactQuery THEN 100
                    WHEN user.name ILIKE :exactQuery THEN 90
                    WHEN user.handle ILIKE :exactQuery THEN 80
                    WHEN user.ename ILIKE :query THEN 70
                    WHEN user.name ILIKE :query THEN 60
                    WHEN user.handle ILIKE :query THEN 50
                    WHEN user.description ILIKE :query THEN 30
                    WHEN user.ename ILIKE :fuzzyQuery THEN 40
                    WHEN user.name ILIKE :fuzzyQuery THEN 35
                    WHEN user.handle ILIKE :fuzzyQuery THEN 30
                    ELSE 0
                END`, 'relevance_score')
            .where(
                "user.name ILIKE :query OR user.ename ILIKE :query OR user.handle ILIKE :query OR user.description ILIKE :query OR user.ename ILIKE :fuzzyQuery OR user.name ILIKE :fuzzyQuery OR user.handle ILIKE :fuzzyQuery",
                { 
                    query: `%${searchQuery}%`,
                    exactQuery: searchQuery,
                    fuzzyQuery: `%${searchQuery.split('').join('%')}%`
                }
            );

        if (verifiedOnly) {
            queryBuilder.andWhere("user.isVerified = :verified", { verified: true });
        }

        queryBuilder.andWhere("user.isArchived = :archived", { archived: false });

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
                queryBuilder.orderBy("relevance_score", "DESC")
                    .addOrderBy("user.isVerified", "DESC")
                    .addOrderBy("user.name", "ASC");
                break;
        }

        return queryBuilder
            .skip((page - 1) * limit)
            .take(limit)
            .getMany();
    };
}

