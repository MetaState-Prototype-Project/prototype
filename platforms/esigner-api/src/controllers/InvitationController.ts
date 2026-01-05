import { Request, Response } from "express";
import { InvitationService } from "../services/InvitationService";

export class InvitationController {
    private invitationService: InvitationService;

    constructor() {
        this.invitationService = new InvitationService();
    }

    inviteSignees = async (req: Request, res: Response) => {
        try {
            if (!req.user) {
                return res.status(401).json({ error: "Authentication required" });
            }

            const { fileId } = req.params;
            const { userIds } = req.body;

            // Allow empty array for self-signed documents (owner will be automatically added)
            if (!userIds || !Array.isArray(userIds)) {
                return res.status(400).json({ error: "userIds must be an array" });
            }

            const invitations = await this.invitationService.inviteSignees(
                fileId,
                userIds,
                req.user.id
            );

            res.status(201).json({
                message: "Invitations sent successfully",
                invitations: invitations.map(inv => ({
                    id: inv.id,
                    fileId: inv.fileId,
                    userId: inv.userId,
                    status: inv.status,
                    invitedAt: inv.invitedAt,
                })),
            });
        } catch (error) {
            console.error("Error inviting signees:", error);
            if (error instanceof Error) {
                return res.status(400).json({ error: error.message });
            }
            res.status(500).json({ error: "Failed to invite signees" });
        }
    };

    getFileInvitations = async (req: Request, res: Response) => {
        try {
            if (!req.user) {
                return res.status(401).json({ error: "Authentication required" });
            }

            const { fileId } = req.params;
            const invitations = await this.invitationService.getFileInvitations(fileId, req.user.id);

            res.json(invitations.map(inv => ({
                id: inv.id,
                fileId: inv.fileId,
                userId: inv.userId,
                user: inv.user ? {
                    id: inv.user.id,
                    name: inv.user.name,
                    ename: inv.user.ename,
                    avatarUrl: inv.user.avatarUrl,
                } : null,
                status: inv.status,
                invitedAt: inv.invitedAt,
                signedAt: inv.signedAt,
                declinedAt: inv.declinedAt,
            })));
        } catch (error) {
            console.error("Error getting file invitations:", error);
            if (error instanceof Error) {
                return res.status(400).json({ error: error.message });
            }
            res.status(500).json({ error: "Failed to get invitations" });
        }
    };

    getUserInvitations = async (req: Request, res: Response) => {
        try {
            if (!req.user) {
                return res.status(401).json({ error: "Authentication required" });
            }

            const invitations = await this.invitationService.getUserInvitations(req.user.id);

            res.json(invitations.map(inv => ({
                id: inv.id,
                fileId: inv.fileId,
                file: inv.file ? {
                    id: inv.file.id,
                    name: inv.file.name,
                    displayName: inv.file.displayName,
                    description: inv.file.description,
                    mimeType: inv.file.mimeType,
                    size: inv.file.size,
                    ownerId: inv.file.ownerId,
                    createdAt: inv.file.createdAt,
                } : null,
                status: inv.status,
                invitedAt: inv.invitedAt,
            })));
        } catch (error) {
            console.error("Error getting user invitations:", error);
            res.status(500).json({ error: "Failed to get invitations" });
        }
    };

    declineInvitation = async (req: Request, res: Response) => {
        try {
            if (!req.user) {
                return res.status(401).json({ error: "Authentication required" });
            }

            const { id } = req.params;
            const declined = await this.invitationService.declineInvitation(id, req.user.id);

            if (!declined) {
                return res.status(404).json({ error: "Invitation not found" });
            }

            res.json({ message: "Invitation declined successfully" });
        } catch (error) {
            console.error("Error declining invitation:", error);
            if (error instanceof Error) {
                return res.status(400).json({ error: error.message });
            }
            res.status(500).json({ error: "Failed to decline invitation" });
        }
    };
}


