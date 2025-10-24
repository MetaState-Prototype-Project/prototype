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

            const user = await this.userService.getUserById(req.user.id);
            if (!user) {
                return res.status(404).json({ error: "User not found" });
            }

            res.json({
                id: user.id,
                ename: user.ename,
                name: user.name,
                handle: user.handle,
                description: user.description,
                avatarUrl: user.avatarUrl,
                bannerUrl: user.bannerUrl,
                isVerified: user.isVerified,
                isPrivate: user.isPrivate,
                email: user.email,
                emailVerified: user.emailVerified,
                createdAt: user.createdAt,
                updatedAt: user.updatedAt,
            });
        } catch (error) {
            console.error("Error getting current user:", error);
            res.status(500).json({ error: "Internal server error" });
        }
    };

    getProfileById = async (req: Request, res: Response) => {
        try {
            const { id } = req.params;
            const user = await this.userService.getUserById(id);

            if (!user) {
                return res.status(404).json({ error: "User not found" });
            }

            res.json({
                id: user.id,
                ename: user.ename,
                name: user.name,
                handle: user.handle,
                description: user.description,
                avatarUrl: user.avatarUrl,
                bannerUrl: user.bannerUrl,
                isVerified: user.isVerified,
                isPrivate: user.isPrivate,
                createdAt: user.createdAt,
                updatedAt: user.updatedAt,
            });
        } catch (error) {
            console.error("Error getting user profile:", error);
            res.status(500).json({ error: "Internal server error" });
        }
    };

    search = async (req: Request, res: Response) => {
        try {
            const { q, limit } = req.query;
            
            if (!q || typeof q !== "string") {
                return res.status(400).json({ error: "Query parameter 'q' is required" });
            }

            const limitNum = limit ? parseInt(limit as string) : 10;
            const users = await this.userService.searchUsers(q, limitNum);

            res.json(users.map(user => ({
                id: user.id,
                ename: user.ename,
                name: user.name,
                handle: user.handle,
                description: user.description,
                avatarUrl: user.avatarUrl,
                bannerUrl: user.bannerUrl,
                isVerified: user.isVerified,
                isPrivate: user.isPrivate,
                createdAt: user.createdAt,
                updatedAt: user.updatedAt,
            })));
        } catch (error) {
            console.error("Error searching users:", error);
            res.status(500).json({ error: "Internal server error" });
        }
    };

    updateProfile = async (req: Request, res: Response) => {
        try {
            if (!req.user) {
                return res.status(401).json({ error: "Authentication required" });
            }

            const { name, handle, description, avatarUrl, bannerUrl, isPrivate } = req.body;
            
            const updateData = {
                name,
                handle,
                description,
                avatarUrl,
                bannerUrl,
                isPrivate,
            };

            const updatedUser = await this.userService.updateUser(req.user.id, updateData);

            res.json({
                id: updatedUser.id,
                ename: updatedUser.ename,
                name: updatedUser.name,
                handle: updatedUser.handle,
                description: updatedUser.description,
                avatarUrl: updatedUser.avatarUrl,
                bannerUrl: updatedUser.bannerUrl,
                isVerified: updatedUser.isVerified,
                isPrivate: updatedUser.isPrivate,
                email: updatedUser.email,
                emailVerified: updatedUser.emailVerified,
                createdAt: updatedUser.createdAt,
                updatedAt: updatedUser.updatedAt,
            });
        } catch (error) {
            console.error("Error updating profile:", error);
            res.status(500).json({ error: "Internal server error" });
        }
    };
}
