import { Repository } from "typeorm";
import { AppDataSource } from "../database/data-source";
import { User } from "../database/entities/User";

export class UserService {
    userRepository: Repository<User>;

    constructor() {
        this.userRepository = AppDataSource.getRepository(User);
    }

    async findUser(ename: string): Promise<User | null> {
        // Only find user, don't create - users should only be created via webhooks
        return this.getUserByEname(ename);
    }

    async getUserByEname(ename: string): Promise<User | null> {
        // Strip @ prefix if present for database lookup
        const cleanEname = this.stripEnamePrefix(ename);
        return this.userRepository.findOne({
            where: { ename: cleanEname },
        });
    }

    async getUserById(id: string): Promise<User | null> {
        return await this.userRepository.findOne({ 
            where: { id },
            relations: ["followers", "following"]
        });
    }

    async createBlankUser(w3id: string): Promise<User> {
        // Strip @ prefix if present before storing
        const cleanEname = this.stripEnamePrefix(w3id);
        const user = this.userRepository.create({
            ename: cleanEname,
        });
        return await this.userRepository.save(user);
    }

    async updateUser(id: string, updateData: Partial<User>): Promise<User> {
        await this.userRepository.update(id, updateData);
        const updatedUser = await this.userRepository.findOneBy({ id });
        if (!updatedUser) {
            throw new Error("User not found after update");
        }
        return updatedUser;
    }

    async searchUsers(query: string, limit: number = 10): Promise<User[]> {
        const q = query.trim().toLowerCase();
        const patternPartial = `%${q}%`;
        const patternPrefix = `${q}%`;

        return await this.userRepository
            .createQueryBuilder("user")
            .where("(user.name ILIKE :patternPartial OR user.handle ILIKE :patternPartial)", {
                patternPartial,
            })
            .addSelect(
                `CASE ` +
                `WHEN LOWER(COALESCE(user.name, '')) = :exact OR LOWER(COALESCE(user.handle, '')) = :exact THEN 0 ` +
                `WHEN LOWER(COALESCE(user.name, '')) LIKE :patternPrefix OR LOWER(COALESCE(user.handle, '')) LIKE :patternPrefix THEN 1 ` +
                `ELSE 2 ` +
                `END`,
                "relevance",
            )
            .setParameter("exact", q)
            .setParameter("patternPrefix", patternPrefix)
            .orderBy("relevance", "ASC")
            .addOrderBy("user.name", "ASC", "NULLS LAST")
            .limit(limit)
            .getMany();
    }

    /**
     * Strips the @ prefix from ename if present
     * @param ename - The ename with or without @ prefix
     * @returns The ename without @ prefix
     */
    private stripEnamePrefix(ename: string): string {
        return ename.startsWith('@') ? ename.slice(1) : ename;
    }
}

