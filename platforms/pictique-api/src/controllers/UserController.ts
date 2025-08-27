import type { Request, Response } from "express";
import { UserService } from "../services/UserService";

export class UserController {
    private userService: UserService;

    constructor() {
        this.userService = new UserService();
    }

    currentUser = async (req: Request, res: Response) => {
        res.json(req.user);
    };

    getProfileById = async (req: Request, res: Response) => {
        try {
            const { id } = req.params;

            if (!id) {
                return res.status(400).json({ error: "User ID is required" });
            }

            const profile = await this.userService.getProfileById(id);
            if (!profile) {
                return res.status(404).json({ error: "User not found" });
            }

            res.json(profile);
        } catch (error) {
            console.error("Error fetching user profile:", error);
            res.status(500).json({ error: "Internal server error" });
        }
    };

    search = async (req: Request, res: Response) => {
        try {
            const { q, page = "1", limit = "10", verified, sort = "relevance" } = req.query;

            if (!q || typeof q !== "string") {
                return res
                    .status(400)
                    .json({ error: "Search query is required" });
            }

            // Validate search query length
            if (q.trim().length < 2) {
                return res
                    .status(400)
                    .json({ error: "Search query must be at least 2 characters long" });
            }

            // Parse and validate pagination parameters
            const pageNum = parseInt(page as string) || 1;
            const limitNum = Math.min(parseInt(limit as string) || 10, 50); // Cap at 50 results
            
            if (pageNum < 1 || limitNum < 1) {
                return res
                    .status(400)
                    .json({ error: "Invalid pagination parameters" });
            }
            
            // Parse verified filter
            const verifiedOnly = verified === "true";

            // Validate sort parameter
            const validSortOptions = ["relevance", "name", "verified", "newest"];
            const sortOption = validSortOptions.includes(sort as string) ? sort as string : "relevance";
            const users = await this.userService.searchUsers(q, pageNum, limitNum, verifiedOnly, sortOption);
            res.json(users);
        } catch (error) {
            console.error("Error searching users:", error);
            res.status(500).json({ error: "Internal server error" });
        }
    };

    getSearchSuggestions = async (req: Request, res: Response) => {
        try {
            const { q, limit = "5" } = req.query;

            if (!q || typeof q !== "string") {
                return res
                    .status(400)
                    .json({ error: "Search query is required" });
            }

            // Parse limit parameter
            const limitNum = Math.min(parseInt(limit as string) || 5, 20); // Cap at 20 suggestions

            const suggestions = await this.userService.getSearchSuggestions(q, limitNum);
            res.json({ suggestions });
        } catch (error) {
            console.error("Error getting search suggestions:", error);
            res.status(500).json({ error: "Internal server error" });
        }
    };

    getPopularSearches = async (req: Request, res: Response) => {
        try {
            const { limit = "10" } = req.query;

            // Parse limit parameter
            const limitNum = Math.min(parseInt(limit as string) || 10, 50); // Cap at 50 results

            const popularSearches = await this.userService.getPopularSearches(limitNum);
            res.json({ popularSearches });
        } catch (error) {
            console.error("Error getting popular searches:", error);
            res.status(500).json({ error: "Internal server error" });
        }
    };

    searchByEnameOrName = async (req: Request, res: Response) => {
        try {
            const { q, page = "1", limit = "10", verified } = req.query;

            if (!q || typeof q !== "string") {
                return res
                    .status(400)
                    .json({ error: "Search query is required" });
            }

            // Validate search query length
            if (q.trim().length < 2) {
                return res
                    .status(400)
                    .json({ error: "Search query must be at least 2 characters long" });
            }

            // Parse and validate pagination parameters
            const pageNum = parseInt(page as string) || 1;
            const limitNum = Math.min(parseInt(limit as string) || 10, 50); // Cap at 50 results
            
            if (pageNum < 1 || limitNum < 1) {
                return res
                    .status(400)
                    .json({ error: "Invalid pagination parameters" });
            }
            
            // Parse verified filter
            const verifiedOnly = verified === "true";

            const users = await this.userService.searchUsersByEnameOrName(q, pageNum, limitNum, verifiedOnly);
            res.json(users);
        } catch (error) {
            console.error("Error searching users by ename or name:", error);
            res.status(500).json({ error: "Internal server error" });
        }
    };

    follow = async (req: Request, res: Response) => {
        try {
            const followerId = req.user?.id;
            const { id: followingId } = req.params;

            if (!followerId || !followingId) {
                return res
                    .status(400)
                    .json({ error: "Missing required fields" });
            }

            const updatedUser = await this.userService.followUser(
                followerId,
                followingId,
            );
            res.json(updatedUser);
        } catch (error) {
            console.error("Error following user:", error);
            res.status(500).json({ error: "Internal server error" });
        }
    };

    updateProfile = async (req: Request, res: Response) => {
        try {
            const userId = req.user?.id;
            const { handle, avatar, name } = req.body;

            if (!userId) {
                return res.status(401).json({ error: "Unauthorized" });
            }

            const user = await this.userService.findById(userId);

            const updatedUser = await this.userService.updateProfile(userId, {
                handle: handle ?? user?.handle,
                avatarUrl: avatar ?? user?.avatarUrl,
                name: name ?? user?.name,
            });

            res.json(updatedUser);
        } catch (error) {
            console.error("Error updating user profile:", error);
            res.status(500).json({ error: "Internal server error" });
        }
    };
}
