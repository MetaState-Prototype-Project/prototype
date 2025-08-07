import { AppDataSource } from "../database/data-source";
import { User } from "../database/entities/User";
import { signToken } from "../utils/jwt";

export class UserService {
    private userRepository = AppDataSource.getRepository(User);

    async getUserById(id: string): Promise<User | null> {
        return this.userRepository.findOne({
            where: { id },
            relations: ["polls", "votes"],
        });
    }

    async getUserByEname(ename: string): Promise<User | null> {
        return this.userRepository.findOne({
            where: { ename },
            relations: ["polls", "votes"],
        });
    }

    async getAllUsers(): Promise<User[]> {
        return this.userRepository.find({
            relations: ["polls", "votes"],
        });
    }

    async createBlankUser(ename: string): Promise<User> {
        const user = this.userRepository.create({
            ename,
            name: ename,
            handle: ename,
            isVerified: false,
            isPrivate: false,
        });
        return this.userRepository.save(user);
    }

    async findOrCreateUser(ename: string): Promise<{ user: User; token: string }> {
        let user = await this.getUserByEname(ename);
        
        if (!user) {
            user = await this.createBlankUser(ename);
        }

        const token = signToken({ userId: user.id });
        return { user, token };
    }

    async updateUser(id: string, updates: Partial<User>): Promise<User | null> {
        await this.userRepository.update(id, updates);
        return this.getUserById(id);
    }

    async deleteUser(id: string): Promise<void> {
        await this.userRepository.delete(id);
    }
} 