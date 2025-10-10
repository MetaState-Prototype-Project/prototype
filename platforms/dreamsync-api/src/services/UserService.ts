import { AppDataSource } from "../database/data-source";
import { User } from "../database/entities/User";

export class UserService {
    private userRepository = AppDataSource.getRepository(User);

    async getUserById(id: string): Promise<User | null> {
        return this.userRepository.findOne({
            where: { id },
        });
    }

    async getUserByEname(ename: string): Promise<User | null> {
        // Strip @ prefix if present for database lookup
        const cleanEname = this.stripEnamePrefix(ename);
        return this.userRepository.findOne({
            where: { ename: cleanEname },
        });
    }

    async getAllUsers(): Promise<User[]> {
        return this.userRepository.find();
    }

    async createBlankUser(ename: string): Promise<User> {
        // Strip @ prefix if present before storing
        const cleanEname = this.stripEnamePrefix(ename);
        const user = this.userRepository.create({
            ename: cleanEname,
            name: cleanEname,
            handle: cleanEname,
            isVerified: false,
            isPrivate: false,
        });
        return this.userRepository.save(user);
    }

    async findUser(ename: string): Promise<User | null> {
        // Only find user, don't create - users should only be created via webhooks
        return this.getUserByEname(ename);
    }

    async updateUser(id: string, updates: Partial<User>): Promise<User | null> {
        await this.userRepository.update(id, updates);
        return this.getUserById(id);
    }

    async searchUsers(query: string): Promise<User[]> {
        return this.userRepository
            .createQueryBuilder("user")
            .where("user.name ILIKE :query", { query: `%${query}%` })
            .orWhere("user.handle ILIKE :query", { query: `%${query}%` })
            .orWhere("user.ename ILIKE :query", { query: `%${query}%` })
            .getMany();
    }

    async deleteUser(id: string): Promise<void> {
        await this.userRepository.delete(id);
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
