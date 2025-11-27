import { AppDataSource } from "../database/data-source";
import { User } from "../database/entities/User";

export class UserService {
    private userRepository = AppDataSource.getRepository(User);

    async findByEname(ename: string): Promise<User | null> {
        // Handle @ symbol variations
        const normalizedEname = ename.startsWith("@") ? ename : `@${ename}`;
        const withoutAt = ename.replace(/^@/, "");

        return (
            (await this.userRepository.findOne({
                where: [{ ename: normalizedEname }, { ename: withoutAt }],
            })) || null
        );
    }

    async getUserById(id: string): Promise<User | null> {
        return this.userRepository.findOneBy({ id });
    }

    async createUser(ename: string, name?: string): Promise<User> {
        const user = this.userRepository.create({
            ename,
            name: name || ename,
        });
        return this.userRepository.save(user);
    }
}

