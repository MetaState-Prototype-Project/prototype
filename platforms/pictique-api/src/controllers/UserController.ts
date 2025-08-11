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
            const { q } = req.query;

            if (!q || typeof q !== "string") {
                return res
                    .status(400)
                    .json({ error: "Search query is required" });
            }

            const users = await this.userService.searchUsers(q);
            res.json(users);
        } catch (error) {
            console.error("Error searching users:", error);
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
