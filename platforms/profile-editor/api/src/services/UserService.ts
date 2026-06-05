import type { Repository } from "typeorm";
import { AppDataSource } from "../db";
import { User } from "../entities/User";

/** Local fields the adapter maps from the User ontology (universal → local). */
const USER_FIELDS = [
    "handle",
    "name",
    "bio",
    "avatarUrl",
    "bannerUrl",
    "isVerified",
    "isPrivate",
    "location",
    "isArchived",
] as const;

export class UserService {
    private repo: Repository<User>;

    constructor() {
        this.repo = AppDataSource.getRepository(User);
    }

    findByEname(ename: string): Promise<User | null> {
        return this.repo.findOneBy({ ename });
    }

    /** Existing row, or a new unsaved one — caller mutates then saves once. */
    async getOrNew(ename: string): Promise<User> {
        return (
            (await this.repo.findOneBy({ ename })) ??
            this.repo.create({ ename })
        );
    }

    save(user: User): Promise<User> {
        return this.repo.save(user);
    }

    /** Upsert from an inbound webhook (adapter fromGlobal output). */
    async upsertFromGlobal(
        ename: string,
        data: Record<string, unknown>,
    ): Promise<User> {
        const user =
            (await this.repo.findOneBy({ ename })) ??
            this.repo.create({ ename });
        const target = user as unknown as Record<string, unknown>;
        for (const key of USER_FIELDS) {
            if (data[key] !== undefined) target[key] = data[key];
        }
        return this.repo.save(user);
    }
}
