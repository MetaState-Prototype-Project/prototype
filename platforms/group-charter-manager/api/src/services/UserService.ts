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

    /**
     * Find a user by ename, regardless of whether the ename is stored with or without @ symbol
     * @param ename - The ename to search for (with or without @ prefix)
     * @returns The user if found, null otherwise
     */
    async findByEname(ename: string): Promise<User | null> {
        // Normalize the input: remove @ if present for comparison
        const normalizedEname = ename.startsWith('@') ? ename.slice(1) : ename;
        const enameWithAt = `@${normalizedEname}`;
        
        // Search for user where ename matches either with or without @
        const user = await this.userRepository
            .createQueryBuilder("user")
            .leftJoinAndSelect("user.followers", "followers")
            .leftJoinAndSelect("user.following", "following")
            .where("user.ename = :enameWithAt OR user.ename = :enameWithoutAt", {
                enameWithAt,
                enameWithoutAt: normalizedEname,
            })
            .getOne();
        
        return user;
    }

    async findUserByEname(
        ename: string
    ): Promise<{ user: User; token: string }> {
        // Find user by ename (handles @ symbol variations)
        const user = await this.findByEname(ename);
        
        // If still no user found, throw an error - never create new users
        if (!user) {
            throw new Error(`User with ename '${ename}' not found. Cannot create new users automatically.`);
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
        // Strip @ prefix from ename if present (database stores without @)
        const cleanEname = ename.startsWith('@') ? ename.slice(1) : ename;
        
        return await this.userRepository.findOne({ 
            where: { ename: cleanEname },
            relations: ['followers', 'following']
        });
    }

    async getUserByName(name: string): Promise<User | null> {
        return await this.userRepository.findOne({ 
            where: { name },
            relations: ['followers', 'following']
        });
    }

    async updateUser(id: string, userData: Partial<User>): Promise<User | null> {
        // Get the current user, merge the data, and save it to trigger ORM events
        const currentUser = await this.getUserById(id);
        if (!currentUser) {
            throw new Error("User not found");
        }
        
        // Merge the new data with the existing user
        Object.assign(currentUser, userData);
        
        // Save the merged user to trigger ORM subscribers
        const updatedUser = await this.userRepository.save(currentUser);
        return updatedUser;
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