import { Request, Response } from "express";
import { GroupService } from "../services/GroupService";
import { CharterSignatureService } from "../services/CharterSignatureService";
import { spinUpEVault } from "web3-adapter";
import { adapter } from "../web3adapter";
import dotenv from "dotenv";

dotenv.config();

export class GroupController {
    private groupService = new GroupService();
    private charterSignatureService = new CharterSignatureService();

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

            // Lock the group so it doesn't sync until charter+ename are added
            adapter.addToLockedIds(group.id);
            console.log("🔒 Locked group from syncing until charter is added:", group.id);

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

            // Check if user is an admin or owner of the group
            const isOwner = group.owner === userId;
            const isAdmin = group.admins?.includes(userId);
            if (!isOwner && !isAdmin) {
                return res.status(403).json({ error: "Access denied - only admins can edit the charter" });
            }

            const { charter } = req.body;
            
            // Check if this is the first charter being added (charterless group getting a charter)
            const needsEVault = !group.charter && !group.ename && charter;
            
            let updateData: any = { charter };
            
            if (needsEVault) {
                console.log("Group getting first charter, provisioning eVault instantly...");
                
                // Provision eVault instantly (without creating GroupManifest)
                const registryUrl = process.env.PUBLIC_REGISTRY_URL;
                const provisionerUrl = process.env.PUBLIC_PROVISIONER_URL;
                
                if (!registryUrl || !provisionerUrl) {
                    throw new Error("Missing required environment variables for eVault creation");
                }
                
                // Just spin up an empty eVault to get the w3id
                const evaultResult = await spinUpEVault(
                    registryUrl,
                    provisionerUrl,
                    "d66b7138-538a-465f-a6ce-f6985854c3f4" // Demo verification code
                );
                
                // Set ename from eVault result
                updateData.ename = evaultResult.w3id;
            }
            
            // Unlock the group so it CAN sync now that it has charter+ename
            if (needsEVault) {
                const lockIndex = adapter.lockedIds.indexOf(id);
                if (lockIndex > -1) {
                    adapter.lockedIds.splice(lockIndex, 1);
                    console.log("🔓 Unlocked group for syncing with charter+ename:", id);
                }
            }
            
            // Now save with both charter and ename (if provisioned)
            const updatedGroup = await this.groupService.updateGroup(id, updateData);
            
            if (!updatedGroup) {
                return res.status(404).json({ error: "Group not found" });
            }
            
            // HACK: Manually trigger sync after delay to ensure complete data is sent
            if (needsEVault) {
                console.log("⏰ Scheduling manual sync for group with charter+ename...");
                setTimeout(async () => {
                    try {
                        // Re-fetch the complete group entity with all relations
                        const completeGroup = await this.groupService.getGroupById(id);
                        if (completeGroup && completeGroup.charter && completeGroup.ename) {
                            console.log("📤 Manually syncing complete group:", {
                                id: completeGroup.id,
                                name: completeGroup.name,
                                hasCharter: !!completeGroup.charter,
                                charterLength: completeGroup.charter?.length || 0,
                                hasEname: !!completeGroup.ename,
                                ename: completeGroup.ename
                            });
                            
                            // Convert to plain object and trigger the adapter manually
                            const plainGroup = JSON.parse(JSON.stringify(completeGroup));
                            await adapter.handleChange({
                                data: plainGroup,
                                tableName: "groups"
                            });
                            
                            console.log("✅ Manual sync completed for group:", completeGroup.id);
                        }
                    } catch (error) {
                        console.error("❌ Error in manual sync:", error);
                    }
                }, 2000); // 2 second delay
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
                return res.status(403).json({ error: "Access denied - only admins can delete groups" });
            }

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

    async getCharterSigningStatus(req: Request, res: Response) {
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

            const signingStatus = await this.charterSignatureService.getGroupSigningStatus(id);
            res.json(signingStatus);
        } catch (error) {
            console.error("Error getting charter signing status:", error);
            res.status(500).json({ error: "Internal server error" });
        }
    }
} 