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
        return await this.userRepository
            .createQueryBuilder("user")
            .where("user.name ILIKE :query OR user.handle ILIKE :query", { query: `%${query}%` })
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
