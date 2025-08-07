import { Request, Response } from "express";
import { UserService } from "../services/UserService";

export class UserController {
    private userService = new UserService();

    async createUser(req: Request, res: Response) {
        try {
            const userData = req.body;
            const user = await this.userService.createUser(userData);
            res.status(201).json(user);
        } catch (error) {
            console.error("Error creating user:", error);
            res.status(500).json({ error: "Internal server error" });
        }
    }

    async getCurrentUser(req: Request, res: Response) {
        try {
            const userId = (req as any).user?.id;
            if (!userId) {
                return res.status(401).json({ error: "Unauthorized" });
            }

            const user = await this.userService.getUserById(userId);
            if (!user) {
                return res.status(404).json({ error: "User not found" });
            }

            res.json(user);
        } catch (error) {
            console.error("Error getting current user:", error);
            res.status(500).json({ error: "Internal server error" });
        }
    }

    async getUserById(req: Request, res: Response) {
        try {
            const { id } = req.params;
            const user = await this.userService.getUserById(id);
            
            if (!user) {
                return res.status(404).json({ error: "User not found" });
            }

            res.json(user);
        } catch (error) {
            console.error("Error getting user by id:", error);
            res.status(500).json({ error: "Internal server error" });
        }
    }

    async updateUser(req: Request, res: Response) {
        try {
            const userId = (req as any).user?.id;
            if (!userId) {
                return res.status(401).json({ error: "Unauthorized" });
            }

            const { name, handle, description, avatarUrl, bannerUrl } = req.body;
            const updatedUser = await this.userService.updateUser(userId, {
                name,
                handle,
                description,
                avatarUrl,
                bannerUrl
            });

            if (!updatedUser) {
                return res.status(404).json({ error: "User not found" });
            }

            res.json(updatedUser);
        } catch (error) {
            console.error("Error updating user:", error);
            res.status(500).json({ error: "Internal server error" });
        }
    }

    async deleteUser(req: Request, res: Response) {
        try {
            const { id } = req.params;
            const success = await this.userService.deleteUser(id);
            
            if (!success) {
                return res.status(404).json({ error: "User not found" });
            }

            res.json({ message: "User deleted successfully" });
        } catch (error) {
            console.error("Error deleting user:", error);
            res.status(500).json({ error: "Internal server error" });
        }
    }

    async getAllUsers(req: Request, res: Response) {
        try {
            const users = await this.userService.getAllUsers();
            res.json(users);
        } catch (error) {
            console.error("Error getting all users:", error);
            res.status(500).json({ error: "Internal server error" });
        }
    }

    async getUserByEname(req: Request, res: Response) {
        try {
            const { ename } = req.params;
            const user = await this.userService.getUserByEname(ename);
            
            if (!user) {
                return res.status(404).json({ error: "User not found" });
            }

            res.json(user);
        } catch (error) {
            console.error("Error getting user by ename:", error);
            res.status(500).json({ error: "Internal server error" });
        }
    }
} 