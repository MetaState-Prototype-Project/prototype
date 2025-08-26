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

    async findUserByEname(
        ename: string
    ): Promise<{ user: User; token: string }> {
        let user: User | null = null;
        
        console.log(`🔍 Looking for user with ename: '${ename}'`);
        
        // Try to find user with the exact ename as provided
        user = await this.userRepository.findOne({
            where: { ename: ename },
        });
        
        if (user) {
            console.log(`✅ Found user with exact ename: '${ename}'`);
        } else {
            // If not found and ename starts with @, try without @
            if (ename.startsWith('@')) {
                const enameWithoutAt = ename.slice(1);
                console.log(`🔍 Trying without @ prefix: '${enameWithoutAt}'`);
                user = await this.userRepository.findOne({
                    where: { ename: enameWithoutAt },
                });
                if (user) {
                    console.log(`✅ Found user without @ prefix: '${enameWithoutAt}'`);
                }
            }
            
            // If not found and ename doesn't start with @, try with @
            if (!user && !ename.startsWith('@')) {
                const enameWithAt = `@${ename}`;
                console.log(`🔍 Trying with @ prefix: '${enameWithAt}'`);
                user = await this.userRepository.findOne({
                    where: { ename: enameWithAt },
                });
                if (user) {
                    console.log(`✅ Found user with @ prefix: '${enameWithAt}'`);
                }
            }
        }
        
        // If still no user found, throw an error - never create new users
        if (!user) {
            console.log(`❌ No user found for ename: '${ename}' (tried with/without @ prefix)`);
            throw new Error(`User with ename '${ename}' not found. Cannot create new users automatically.`);
        }

        const token = signToken({ userId: user.id });
        console.log(`🎉 Successfully authenticated user: ${user.ename} (ID: ${user.id})`);
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