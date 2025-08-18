import { Request, Response } from "express";
import { GroupService } from "../services/GroupService";

export class GroupController {
    private groupService = new GroupService();

    async createGroup(req: Request, res: Response) {
        try {
            const userId = (req as any).user?.id;
            if (!userId) {
                return res.status(401).json({ error: "Unauthorized" });
            }

            const { name, description, participants } = req.body;
            
            const group = await this.groupService.createGroup({
                name,
                description,
                owner: userId,
                admins: [userId],
                participants: []
            });

            // Add participants including the creator
            const allParticipants = [...new Set([userId, ...participants])];
            for (const participantId of allParticipants) {
                await this.groupService.addParticipantToGroup(group.id, participantId);
            }

            const fullGroup = await this.groupService.getGroupById(group.id);
            res.status(201).json(fullGroup);
        } catch (error) {
            console.error("Error creating group:", error);
            res.status(500).json({ error: "Internal server error" });
        }
    }

    async getGroupById(req: Request, res: Response) {
        try {
            const { id } = req.params;
            const group = await this.groupService.getGroupById(id);
            
            if (!group) {
                return res.status(404).json({ error: "Group not found" });
            }

            res.json(group);
        } catch (error) {
            console.error("Error getting group by id:", error);
            res.status(500).json({ error: "Internal server error" });
        }
    }

    async updateGroup(req: Request, res: Response) {
        try {
            const { id } = req.params;
            const userId = (req as any).user?.id;
            
            if (!userId) {
                return res.status(401).json({ error: "Unauthorized" });
            }

            const group = await this.groupService.getGroupById(id);
            if (!group) {
                return res.status(404).json({ error: "Group not found" });
            }

            // Check if user is owner or admin
            const isOwner = group.owner === userId;
            const isAdmin = group.admins?.includes(userId);
            
            if (!isOwner && !isAdmin) {
                return res.status(403).json({ error: "Access denied" });
            }

            const groupData = req.body;
            const updatedGroup = await this.groupService.updateGroup(id, groupData);
            if (!updatedGroup) {
                return res.status(404).json({ error: "Group not found" });
            }

            res.json(updatedGroup);
        } catch (error) {
            console.error("Error updating group:", error);
            res.status(500).json({ error: "Internal server error" });
        }
    }

    async updateCharter(req: Request, res: Response) {
        try {
            const { id } = req.params;
            const userId = (req as any).user?.id;
            
            if (!userId) {
                return res.status(401).json({ error: "Unauthorized" });
            }

            const group = await this.groupService.getGroupById(id);
            if (!group) {
                return res.status(404).json({ error: "Group not found" });
            }

            // Check if user is a participant in the group
            const isParticipant = group.participants?.some(p => p.id === userId);
            if (!isParticipant) {
                return res.status(403).json({ error: "Access denied - you must be a participant in this group" });
            }

            const { charter } = req.body;
            const updatedGroup = await this.groupService.updateGroup(id, { charter });
            
            if (!updatedGroup) {
                return res.status(404).json({ error: "Group not found" });
            }

            res.json(updatedGroup);
        } catch (error) {
            console.error("Error updating charter:", error);
            res.status(500).json({ error: "Internal server error" });
        }
    }

    async deleteGroup(req: Request, res: Response) {
        try {
            const { id } = req.params;
            const success = await this.groupService.deleteGroup(id);
            
            if (!success) {
                return res.status(404).json({ error: "Group not found" });
            }

            res.json({ message: "Group deleted successfully" });
        } catch (error) {
            console.error("Error deleting group:", error);
            res.status(500).json({ error: "Internal server error" });
        }
    }

    async getAllGroups(req: Request, res: Response) {
        try {
            const groups = await this.groupService.getAllGroups();
            res.json(groups);
        } catch (error) {
            console.error("Error getting all groups:", error);
            res.status(500).json({ error: "Internal server error" });
        }
    }

    async getUserGroups(req: Request, res: Response) {
        try {
            const userId = (req as any).user?.id;
            if (!userId) {
                return res.status(401).json({ error: "Unauthorized" });
            }

            const groups = await this.groupService.getUserGroups(userId);
            res.json(groups);
        } catch (error) {
            console.error("Error getting user groups:", error);
            res.status(500).json({ error: "Internal server error" });
        }
    }

    async getGroup(req: Request, res: Response) {
        try {
            const { groupId } = req.params;
            const userId = (req as any).user?.id;
            
            if (!userId) {
                return res.status(401).json({ error: "Unauthorized" });
            }

            const group = await this.groupService.getGroupById(groupId);
            if (!group) {
                return res.status(404).json({ error: "Group not found" });
            }

            // Check if user is a participant
            const isParticipant = group.participants.some(p => p.id === userId);
            if (!isParticipant) {
                return res.status(403).json({ error: "Access denied" });
            }

            res.json(group);
        } catch (error) {
            console.error("Error getting group:", error);
            res.status(500).json({ error: "Internal server error" });
        }
    }

    async addParticipants(req: Request, res: Response) {
        try {
            const { groupId } = req.params;
            const { participants } = req.body;
            const userId = (req as any).user?.id;

            if (!userId) {
                return res.status(401).json({ error: "Unauthorized" });
            }

            const group = await this.groupService.getGroupById(groupId);
            if (!group) {
                return res.status(404).json({ error: "Group not found" });
            }

            // Check if user is admin or owner
            const isAdmin = group.admins?.includes(userId) || group.owner === userId;
            if (!isAdmin) {
                return res.status(403).json({ error: "Access denied" });
            }

            for (const participantId of participants) {
                await this.groupService.addParticipantToGroup(groupId, participantId);
            }

            const updatedGroup = await this.groupService.getGroupById(groupId);
            res.json(updatedGroup);
        } catch (error) {
            console.error("Error adding participants:", error);
            res.status(500).json({ error: "Internal server error" });
        }
    }

    async removeParticipant(req: Request, res: Response) {
        try {
            const { groupId, userId: participantId } = req.params;
            const userId = (req as any).user?.id;

            if (!userId) {
                return res.status(401).json({ error: "Unauthorized" });
            }

            const group = await this.groupService.getGroupById(groupId);
            if (!group) {
                return res.status(404).json({ error: "Group not found" });
            }

            // Check if user is admin or owner
            const isAdmin = group.admins?.includes(userId) || group.owner === userId;
            if (!isAdmin) {
                return res.status(403).json({ error: "Access denied" });
            }

            await this.groupService.removeParticipantFromGroup(groupId, participantId);

            const updatedGroup = await this.groupService.getGroupById(groupId);
            res.json(updatedGroup);
        } catch (error) {
            console.error("Error removing participant:", error);
            res.status(500).json({ error: "Internal server error" });
        }
    }

    /**
     * Admin endpoint to ensure Cerberus monitoring is set up for all groups
     */
    async ensureCerberusInAllGroups(req: Request, res: Response) {
        try {
            const userId = (req as any).user?.id;
            if (!userId) {
                return res.status(401).json({ error: "Unauthorized" });
            }

            // This is an admin-only operation - you might want to add more specific admin checks
            console.log(`User ${userId} requested to set up Cerberus monitoring for all groups`);
            
            await this.groupService.ensureCerberusInAllGroups();
            
            res.json({ message: "Cerberus monitoring has been set up for all groups with charter requirements" });
        } catch (error) {
            console.error("Error setting up Cerberus monitoring for all groups:", error);
            res.status(500).json({ error: "Internal server error" });
        }
    }
} 