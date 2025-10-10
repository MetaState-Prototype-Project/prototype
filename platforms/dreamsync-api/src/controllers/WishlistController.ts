import { Request, Response } from "express";
import { WishlistService } from "../services/WishlistService";

export class WishlistController {
    private wishlistService: WishlistService;

    constructor() {
        this.wishlistService = new WishlistService();
    }

    createWishlist = async (req: Request, res: Response) => {
        try {
            const userId = req.user?.id;
            if (!userId) {
                return res.status(401).json({ error: "Unauthorized" });
            }

            const { title, content, isPublic } = req.body;

            if (!title || !content) {
                return res.status(400).json({ 
                    error: "Title and content are required" 
                });
            }

            const wishlist = await this.wishlistService.createWishlist(
                userId,
                title,
                content,
                isPublic || false
            );

            res.status(201).json(wishlist);
        } catch (error) {
            console.error("Error creating wishlist:", error);
            res.status(500).json({ error: "Internal server error" });
        }
    };

    updateWishlist = async (req: Request, res: Response) => {
        try {
            const userId = req.user?.id;
            if (!userId) {
                return res.status(401).json({ error: "Unauthorized" });
            }

            const { id } = req.params;
            const updates = req.body;

            const wishlist = await this.wishlistService.updateWishlist(
                id,
                userId,
                updates
            );

            res.json(wishlist);
        } catch (error: any) {
            console.error("Error updating wishlist:", error);
            if (error.message === "Wishlist not found or access denied") {
                return res.status(404).json({ error: error.message });
            }
            res.status(500).json({ error: "Internal server error" });
        }
    };

    getUserWishlists = async (req: Request, res: Response) => {
        try {
            const userId = req.user?.id;
            if (!userId) {
                return res.status(401).json({ error: "Unauthorized" });
            }

            const wishlists = await this.wishlistService.getUserWishlists(userId);
            res.json(wishlists);
        } catch (error) {
            console.error("Error fetching user wishlists:", error);
            res.status(500).json({ error: "Internal server error" });
        }
    };

    getWishlistById = async (req: Request, res: Response) => {
        try {
            const userId = req.user?.id;
            if (!userId) {
                return res.status(401).json({ error: "Unauthorized" });
            }

            const { id } = req.params;
            const wishlist = await this.wishlistService.getWishlistById(id, userId);

            if (!wishlist) {
                return res.status(404).json({ error: "Wishlist not found" });
            }

            res.json(wishlist);
        } catch (error) {
            console.error("Error fetching wishlist:", error);
            res.status(500).json({ error: "Internal server error" });
        }
    };

    getPublicWishlists = async (req: Request, res: Response) => {
        try {
            const wishlists = await this.wishlistService.getPublicWishlists();
            res.json(wishlists);
        } catch (error) {
            console.error("Error fetching public wishlists:", error);
            res.status(500).json({ error: "Internal server error" });
        }
    };

    deleteWishlist = async (req: Request, res: Response) => {
        try {
            const userId = req.user?.id;
            if (!userId) {
                return res.status(401).json({ error: "Unauthorized" });
            }

            const { id } = req.params;
            await this.wishlistService.deleteWishlist(id, userId);

            res.status(204).send();
        } catch (error: any) {
            console.error("Error deleting wishlist:", error);
            if (error.message === "Wishlist not found or access denied") {
                return res.status(404).json({ error: error.message });
            }
            res.status(500).json({ error: "Internal server error" });
        }
    };
}
