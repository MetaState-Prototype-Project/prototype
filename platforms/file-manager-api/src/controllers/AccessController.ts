import { Request, Response } from "express";
import { AccessService } from "../services/AccessService";

export class AccessController {
    private accessService: AccessService;

    constructor() {
        this.accessService = new AccessService();
    }

    grantFileAccess = async (req: Request, res: Response) => {
        try {
            if (!req.user) {
                return res.status(401).json({ error: "Authentication required" });
            }

            const { id } = req.params;
            const { userId, permission = "view" } = req.body;

            if (!userId) {
                return res.status(400).json({ error: "userId is required" });
            }

            // Check if the user is the owner of the file
            const fileService = new (require('../services/FileService').FileService)();
            const file = await fileService.getFileById(id, req.user.id);
            
            if (!file) {
                return res.status(404).json({ error: "File not found" });
            }
            
            if (file.ownerId !== req.user.id) {
                return res.status(403).json({ error: "Only the file owner can grant access" });
            }

            const access = await this.accessService.grantFileAccess(
                id,
                userId,
                req.user.id,
                permission
            );

            res.status(201).json({
                id: access.id,
                fileId: access.fileId,
                userId: access.userId,
                grantedBy: access.grantedBy,
                permission: access.permission,
                createdAt: access.createdAt,
            });
        } catch (error) {
            console.error("Error granting file access:", error);
            if (error instanceof Error) {
                return res.status(400).json({ error: error.message });
            }
            res.status(500).json({ error: "Failed to grant file access" });
        }
    };

    revokeFileAccess = async (req: Request, res: Response) => {
        try {
            if (!req.user) {
                return res.status(401).json({ error: "Authentication required" });
            }

            const { id, userId } = req.params;

            // Check if the user is the owner of the file
            const fileService = new (require('../services/FileService').FileService)();
            const file = await fileService.getFileById(id, req.user.id);
            
            if (!file) {
                return res.status(404).json({ error: "File not found" });
            }
            
            if (file.ownerId !== req.user.id) {
                return res.status(403).json({ error: "Only the file owner can revoke access" });
            }

            const revoked = await this.accessService.revokeFileAccess(
                id,
                userId,
                req.user.id
            );

            if (!revoked) {
                return res.status(404).json({ error: "Access not found or not authorized" });
            }

            res.json({ message: "File access revoked successfully" });
        } catch (error) {
            console.error("Error revoking file access:", error);
            if (error instanceof Error) {
                return res.status(400).json({ error: error.message });
            }
            res.status(500).json({ error: "Failed to revoke file access" });
        }
    };

    getFileAccess = async (req: Request, res: Response) => {
        try {
            if (!req.user) {
                return res.status(401).json({ error: "Authentication required" });
            }

            const { id } = req.params;
            
            // First check if the file exists and if the user has access to it
            const fileService = new (require('../services/FileService').FileService)();
            const file = await fileService.getFileById(id, req.user.id);
            
            if (!file) {
                return res.status(404).json({ error: "File not found" });
            }
            
            // Only allow owner to see who the file is shared with
            if (file.ownerId !== req.user.id) {
                return res.status(403).json({ error: "Only the file owner can view access list" });
            }

            const accessList = await this.accessService.getFileAccess(id, req.user.id);

            res.json(accessList.map(access => ({
                id: access.id,
                fileId: access.fileId,
                userId: access.userId,
                user: access.user ? {
                    id: access.user.id,
                    name: access.user.name,
                    ename: access.user.ename,
                    avatarUrl: access.user.avatarUrl,
                } : null,
                grantedBy: access.grantedBy,
                granter: access.granter ? {
                    id: access.granter.id,
                    name: access.granter.name,
                    ename: access.granter.ename,
                } : null,
                permission: access.permission,
                createdAt: access.createdAt,
            })));
        } catch (error) {
            console.error("Error getting file access:", error);
            if (error instanceof Error) {
                return res.status(400).json({ error: error.message });
            }
            res.status(500).json({ error: "Failed to get file access" });
        }
    };

    grantFolderAccess = async (req: Request, res: Response) => {
        try {
            if (!req.user) {
                return res.status(401).json({ error: "Authentication required" });
            }

            const { id } = req.params;
            const { userId, permission = "view" } = req.body;

            if (!userId) {
                return res.status(400).json({ error: "userId is required" });
            }

            const access = await this.accessService.grantFolderAccess(
                id,
                userId,
                req.user.id,
                permission
            );

            res.status(201).json({
                id: access.id,
                folderId: access.folderId,
                userId: access.userId,
                grantedBy: access.grantedBy,
                permission: access.permission,
                createdAt: access.createdAt,
            });
        } catch (error) {
            console.error("Error granting folder access:", error);
            if (error instanceof Error) {
                return res.status(400).json({ error: error.message });
            }
            res.status(500).json({ error: "Failed to grant folder access" });
        }
    };

    revokeFolderAccess = async (req: Request, res: Response) => {
        try {
            if (!req.user) {
                return res.status(401).json({ error: "Authentication required" });
            }

            const { id, userId } = req.params;

            const revoked = await this.accessService.revokeFolderAccess(
                id,
                userId,
                req.user.id
            );

            if (!revoked) {
                return res.status(404).json({ error: "Access not found or not authorized" });
            }

            res.json({ message: "Folder access revoked successfully" });
        } catch (error) {
            console.error("Error revoking folder access:", error);
            if (error instanceof Error) {
                return res.status(400).json({ error: error.message });
            }
            res.status(500).json({ error: "Failed to revoke folder access" });
        }
    };

    getFolderAccess = async (req: Request, res: Response) => {
        try {
            if (!req.user) {
                return res.status(401).json({ error: "Authentication required" });
            }

            const { id } = req.params;
            const accessList = await this.accessService.getFolderAccess(id, req.user.id);

            res.json(accessList.map(access => ({
                id: access.id,
                folderId: access.folderId,
                userId: access.userId,
                user: access.user ? {
                    id: access.user.id,
                    name: access.user.name,
                    ename: access.user.ename,
                    avatarUrl: access.user.avatarUrl,
                } : null,
                grantedBy: access.grantedBy,
                granter: access.granter ? {
                    id: access.granter.id,
                    name: access.granter.name,
                    ename: access.granter.ename,
                } : null,
                permission: access.permission,
                createdAt: access.createdAt,
            })));
        } catch (error) {
            console.error("Error getting folder access:", error);
            if (error instanceof Error) {
                return res.status(400).json({ error: error.message });
            }
            res.status(500).json({ error: "Failed to get folder access" });
        }
    };
}

