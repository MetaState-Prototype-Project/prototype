import { Request, Response } from "express";
import { UserService } from "../services/UserService";

export class UserController {
    private userService: UserService;

    constructor() {
        this.userService = new UserService();
    }

    currentUser = async (req: Request, res: Response) => {
        try {
            if (!req.user) {
                return res.status(401).json({ error: "Authentication required" });
            }

            res.json({
                id: req.user.id,
                name: req.user.name,
                ename: req.user.ename,
                handle: req.user.handle,
                avatarUrl: req.user.avatarUrl,
                isVerified: req.user.isVerified,
            });
        } catch (error) {
            console.error("Error getting current user:", error);
            res.status(500).json({ error: "Failed to get current user" });
        }
    };

    search = async (req: Request, res: Response) => {
        try {
            if (!req.user) {
                return res.status(401).json({ error: "Authentication required" });
            }

            const { query, page = 1, limit = 10 } = req.query;

            if (!query || typeof query !== 'string') {
                return res.status(400).json({ error: "Query parameter is required" });
            }

            const users = await this.userService.searchUsers(
                query,
                Number(page),
                Number(limit),
                false,
                "relevance"
            );

            res.json(users);
        } catch (error) {
            console.error("Error searching users:", error);
            res.status(500).json({ error: "Failed to search users" });
        }
    };
}

