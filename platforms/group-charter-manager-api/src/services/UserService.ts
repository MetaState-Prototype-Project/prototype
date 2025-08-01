import { AppDataSource } from "../database/data-source";
import { User } from "../database/entities/User";

export class UserService {
    public userRepository = AppDataSource.getRepository(User);

    async createUser(userData: Partial<User>): Promise<User> {
        const user = this.userRepository.create(userData);
        return await this.userRepository.save(user);
    }

    async getUserById(id: string): Promise<User | null> {
        return await this.userRepository.findOne({ 
            where: { id },
            relations: ['followers', 'following', 'groups']
        });
    }

    async getUserByEname(ename: string): Promise<User | null> {
        return await this.userRepository.findOne({ 
            where: { ename },
            relations: ['followers', 'following', 'groups']
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
            relations: ['followers', 'following', 'groups']
        });
    }
} 