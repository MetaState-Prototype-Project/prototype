import { Request, Response } from "express";
import { GroupService } from "../services/GroupService";
import { AppDataSource } from "../database/data-source";
import { User } from "../database/entities/User";

export class GroupController {
    private groupService: GroupService;
    private userRepository = AppDataSource.getRepository(User);

    constructor() {
        this.groupService = new GroupService();
    }

    // Create a new group
    createGroup = async (req: Request, res: Response) => {
        try {
            const { name, description, memberIds, adminIds, isPrivate, visibility, avatarUrl, bannerUrl } = req.body;
            
            if (!name) {
                return res.status(400).json({ error: "Group name is required" });
            }

            const group = await this.groupService.createGroup(
                name,
                description,
                memberIds || [],
                adminIds || [],
                isPrivate || false,
                visibility || "public",
                avatarUrl,
                bannerUrl
            );

            res.status(201).json(group);
        } catch (error) {
            console.error("Error creating group:", error);
            res.status(500).json({ error: "Failed to create group" });
        }
    };

    // Get group by ID
    getGroupById = async (req: Request, res: Response) => {
        try {
            const { id } = req.params;
            const group = await this.groupService.getGroupById(id);
            
            if (!group) {
                return res.status(404).json({ error: "Group not found" });
            }

            res.json(group);
        } catch (error) {
            console.error("Error getting group:", error);
            res.status(500).json({ error: "Failed to get group" });
        }
    };

    // Update group
    updateGroup = async (req: Request, res: Response) => {
        try {
            const { id } = req.params;
            const updates = req.body;
            
            const group = await this.groupService.updateGroup(id, updates);
            res.json(group);
        } catch (error) {
            console.error("Error updating group:", error);
            res.status(500).json({ error: "Failed to update group" });
        }
    };

    // Delete group
    deleteGroup = async (req: Request, res: Response) => {
        try {
            const { id } = req.params;
            await this.groupService.deleteGroup(id);
            res.status(204).send();
        } catch (error) {
            console.error("Error deleting group:", error);
            res.status(500).json({ error: "Failed to delete group" });
        }
    };

    // Get user's groups
    getUserGroups = async (req: Request, res: Response) => {
        try {
            // Get user ID from authenticated request
            const userId = (req as any).user?.id;
            if (!userId) {
                return res.status(401).json({ error: "Unauthorized" });
            }

            const { page = 1, limit = 10 } = req.query;
            
            const result = await this.groupService.getUserGroups(
                userId,
                parseInt(page as string),
                parseInt(limit as string)
            );
            
            // Return just the groups array, not the full result object
            res.json(result.groups);
        } catch (error) {
            console.error("Error getting user groups:", error);
            res.status(500).json({ error: "Failed to get user groups" });
        }
    };

    // Add members to group
    addMembers = async (req: Request, res: Response) => {
        try {
            const { id } = req.params;
            const { memberIds } = req.body;
            
            if (!Array.isArray(memberIds)) {
                return res.status(400).json({ error: "memberIds must be an array" });
            }

            const group = await this.groupService.addMembers(id, memberIds);
            res.json(group);
        } catch (error) {
            console.error("Error adding members:", error);
            res.status(500).json({ error: "Failed to add members" });
        }
    };

    // Remove member from group
    removeMember = async (req: Request, res: Response) => {
        try {
            const { id, userId } = req.params;
            const group = await this.groupService.removeMember(id, userId);
            res.json(group);
        } catch (error) {
            console.error("Error removing member:", error);
            res.status(500).json({ error: "Failed to remove member" });
        }
    };

    // Add admins to group
    addAdmins = async (req: Request, res: Response) => {
        try {
            const { id } = req.params;
            const { adminIds } = req.body;
            
            if (!Array.isArray(adminIds)) {
                return res.status(400).json({ error: "adminIds must be an array" });
            }

            const group = await this.groupService.addAdmins(id, adminIds);
            res.json(group);
        } catch (error) {
            console.error("Error adding admins:", error);
            res.status(500).json({ error: "Failed to add admins" });
        }
    };

    // Remove admin from group
    removeAdmin = async (req: Request, res: Response) => {
        try {
            const { id, userId } = req.params;
            const group = await this.groupService.removeAdmin(id, userId);
            res.json(group);
        } catch (error) {
            console.error("Error removing admin:", error);
            res.status(500).json({ error: "Failed to remove admin" });
        }
    };
} 