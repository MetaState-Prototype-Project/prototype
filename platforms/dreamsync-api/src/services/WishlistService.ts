import { AppDataSource } from "../database/data-source";
import { Wishlist } from "../database/entities/Wishlist";
import { User } from "../database/entities/User";
import { Repository } from "typeorm";

export class WishlistService {
    private wishlistRepository: Repository<Wishlist>;
    private userRepository: Repository<User>;

    constructor() {
        this.wishlistRepository = AppDataSource.getRepository(Wishlist);
        this.userRepository = AppDataSource.getRepository(User);
    }

    async createWishlist(
        userId: string,
        title: string,
        content: string,
        isPublic: boolean = false
    ): Promise<Wishlist> {
        const user = await this.userRepository.findOne({ where: { id: userId } });
        if (!user) {
            throw new Error("User not found");
        }

        const wishlist = this.wishlistRepository.create({
            title,
            content,
            isPublic,
            userId,
            metadata: {
                tags: [],
                categories: [],
                analysisVersion: 1
            }
        });

        return await this.wishlistRepository.save(wishlist);
    }

    async updateWishlist(
        wishlistId: string,
        userId: string,
        updates: Partial<{
            title: string;
            content: string;
            isPublic: boolean;
            isActive: boolean;
            metadata: any;
        }>
    ): Promise<Wishlist> {
        const wishlist = await this.wishlistRepository.findOne({
            where: { id: wishlistId, userId }
        });

        if (!wishlist) {
            throw new Error("Wishlist not found or access denied");
        }

        Object.assign(wishlist, updates);
        return await this.wishlistRepository.save(wishlist);
    }

    async getUserWishlists(userId: string): Promise<Wishlist[]> {
        return await this.wishlistRepository.find({
            where: { userId, isActive: true },
            order: { updatedAt: "DESC" }
        });
    }

    async getWishlistById(wishlistId: string, userId: string): Promise<Wishlist | null> {
        return await this.wishlistRepository.findOne({
            where: { id: wishlistId, userId }
        });
    }

    async getPublicWishlists(): Promise<Wishlist[]> {
        return await this.wishlistRepository.find({
            where: { isPublic: true, isActive: true },
            relations: ["user"],
            order: { updatedAt: "DESC" }
        });
    }

    async deleteWishlist(wishlistId: string, userId: string): Promise<void> {
        const wishlist = await this.wishlistRepository.findOne({
            where: { id: wishlistId, userId }
        });

        if (!wishlist) {
            throw new Error("Wishlist not found or access denied");
        }

        await this.wishlistRepository.softDelete(wishlistId);
    }

    async getAllActiveWishlists(): Promise<Wishlist[]> {
        return await this.wishlistRepository.find({
            where: { isActive: true },
            relations: ["user"],
            order: { updatedAt: "DESC" }
        });
    }

    async markWishlistAsAnalyzed(wishlistId: string, analysisVersion: number): Promise<void> {
        await this.wishlistRepository.update(wishlistId, {
            metadata: {
                lastAnalyzed: new Date(),
                analysisVersion
            }
        });
    }

    async getWishlistsForMatching(): Promise<Wishlist[]> {
        // Get wishlists that haven't been analyzed recently or at all
        const cutoffDate = new Date();
        cutoffDate.setHours(cutoffDate.getHours() - 24); // 24 hours ago

        return await this.wishlistRepository
            .createQueryBuilder("wishlist")
            .leftJoinAndSelect("wishlist.user", "user")
            .where("wishlist.isActive = :isActive", { isActive: true })
            .andWhere(
                "(wishlist.metadata->>'lastAnalyzed' IS NULL OR " +
                "CAST(wishlist.metadata->>'lastAnalyzed' AS timestamp) < :cutoffDate)",
                { cutoffDate }
            )
            .orderBy("wishlist.updatedAt", "DESC")
            .getMany();
    }
}
