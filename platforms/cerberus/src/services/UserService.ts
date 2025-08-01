import { AppDataSource } from "../database/data-source";
import { User } from "../database/entities/User";
import { signToken } from "../utils/jwt";

export class UserService {
    public userRepository = AppDataSource.getRepository(User);

    async createUser(userData: Partial<User>): Promise<User> {
        const user = this.userRepository.create(userData);
        return await this.userRepository.save(user);
    }

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

    async getUserById(id: string): Promise<User | null> {
        return await this.userRepository.findOne({ 
            where: { id },
            relations: ['followers', 'following']
        });
    }

    async getUserByEname(ename: string): Promise<User | null> {
        return await this.userRepository.findOne({ 
            where: { ename },
            relations: ['followers', 'following']
        });
    }

    async updateUser(id: string, userData: Partial<User>): Promise<User | null> {
        await this.userRepository.update(id, userData);
        return await this.getUserById(id);
    }

    async saveUser(user: User): Promise<User> {
        return await this.userRepository.save(user);
    }

    async deleteUser(id: string): Promise<boolean> {
        const result = await this.userRepository.delete(id);
        return result.affected ? result.affected > 0 : false;
    }

    async getAllUsers(): Promise<User[]> {
        return await this.userRepository.find({
            relations: ['followers', 'following']
        });
    }
} 