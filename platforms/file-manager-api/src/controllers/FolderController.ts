import { Request, Response } from "express";
import { FolderService } from "../services/FolderService";

export class FolderController {
    private folderService: FolderService;

    constructor() {
        this.folderService = new FolderService();
    }

    createFolder = async (req: Request, res: Response) => {
        try {
            if (!req.user) {
                return res.status(401).json({ error: "Authentication required" });
            }

            const { name, parentFolderId } = req.body;

            if (!name) {
                return res.status(400).json({ error: "Folder name is required" });
            }

            const folder = await this.folderService.createFolder(
                name,
                req.user.id,
                parentFolderId === 'null' || parentFolderId === '' ? null : parentFolderId
            );

            res.status(201).json({
                id: folder.id,
                name: folder.name,
                ownerId: folder.ownerId,
                parentFolderId: folder.parentFolderId,
                createdAt: folder.createdAt,
                updatedAt: folder.updatedAt,
            });
        } catch (error) {
            console.error("Error creating folder:", error);
            if (error instanceof Error) {
                return res.status(400).json({ error: error.message });
            }
            res.status(500).json({ error: "Failed to create folder" });
        }
    };

    getFolders = async (req: Request, res: Response) => {
        try {
            if (!req.user) {
                return res.status(401).json({ error: "Authentication required" });
            }

            const { parentFolderId } = req.query;
            const parentFolderIdParam = parentFolderId === 'null' || parentFolderId === '' ? null : parentFolderId as string | undefined;

            const folders = await this.folderService.getUserFolders(req.user.id, parentFolderIdParam);
            res.json(folders.map(folder => ({
                id: folder.id,
                name: folder.name,
                ownerId: folder.ownerId,
                parentFolderId: folder.parentFolderId,
                createdAt: folder.createdAt,
                updatedAt: folder.updatedAt,
            })));
        } catch (error) {
            console.error("Error getting folders:", error);
            res.status(500).json({ error: "Failed to get folders" });
        }
    };

    getFolder = async (req: Request, res: Response) => {
        try {
            if (!req.user) {
                return res.status(401).json({ error: "Authentication required" });
            }

            const { id } = req.params;
            const folder = await this.folderService.getFolderById(id, req.user.id);

            if (!folder) {
                return res.status(404).json({ error: "Folder not found" });
            }

            res.json({
                id: folder.id,
                name: folder.name,
                ownerId: folder.ownerId,
                parentFolderId: folder.parentFolderId,
                createdAt: folder.createdAt,
                updatedAt: folder.updatedAt,
            });
        } catch (error) {
            console.error("Error getting folder:", error);
            res.status(500).json({ error: "Failed to get folder" });
        }
    };

    getFolderContents = async (req: Request, res: Response) => {
        try {
            if (!req.user) {
                return res.status(401).json({ error: "Authentication required" });
            }

            const { id } = req.params;
            const contents = await this.folderService.getFolderContents(id, req.user.id);

            res.json({
                files: contents.files.map(file => ({
                    id: file.id,
                    name: file.name,
                    displayName: file.displayName,
                    description: file.description,
                    mimeType: file.mimeType,
                    size: file.size,
                    ownerId: file.ownerId,
                    folderId: file.folderId,
                    createdAt: file.createdAt,
                    updatedAt: file.updatedAt,
                })),
                folders: contents.folders.map(folder => ({
                    id: folder.id,
                    name: folder.name,
                    ownerId: folder.ownerId,
                    parentFolderId: folder.parentFolderId,
                    createdAt: folder.createdAt,
                    updatedAt: folder.updatedAt,
                })),
            });
        } catch (error) {
            console.error("Error getting folder contents:", error);
            if (error instanceof Error) {
                return res.status(400).json({ error: error.message });
            }
            res.status(500).json({ error: "Failed to get folder contents" });
        }
    };

    updateFolder = async (req: Request, res: Response) => {
        try {
            if (!req.user) {
                return res.status(401).json({ error: "Authentication required" });
            }

            const { id } = req.params;
            const { name, parentFolderId } = req.body;

            const folder = await this.folderService.updateFolder(
                id,
                req.user.id,
                name,
                parentFolderId !== undefined ? (parentFolderId === 'null' || parentFolderId === '' ? null : parentFolderId) : undefined
            );

            if (!folder) {
                return res.status(404).json({ error: "Folder not found or not authorized" });
            }

            res.json({
                id: folder.id,
                name: folder.name,
                ownerId: folder.ownerId,
                parentFolderId: folder.parentFolderId,
                createdAt: folder.createdAt,
                updatedAt: folder.updatedAt,
            });
        } catch (error) {
            console.error("Error updating folder:", error);
            if (error instanceof Error) {
                return res.status(400).json({ error: error.message });
            }
            res.status(500).json({ error: "Failed to update folder" });
        }
    };

    deleteFolder = async (req: Request, res: Response) => {
        try {
            if (!req.user) {
                return res.status(401).json({ error: "Authentication required" });
            }

            const { id } = req.params;
            const deleted = await this.folderService.deleteFolder(id, req.user.id);

            if (!deleted) {
                return res.status(404).json({ error: "Folder not found or not authorized" });
            }

            res.json({ message: "Folder deleted successfully" });
        } catch (error) {
            console.error("Error deleting folder:", error);
            res.status(500).json({ error: "Failed to delete folder" });
        }
    };

    moveFolder = async (req: Request, res: Response) => {
        try {
            if (!req.user) {
                return res.status(401).json({ error: "Authentication required" });
            }

            const { id } = req.params;
            const { parentFolderId } = req.body;
            const parentFolderIdParam = parentFolderId === 'null' || parentFolderId === '' ? null : parentFolderId as string | null;

            const folder = await this.folderService.moveFolder(id, parentFolderIdParam, req.user.id);

            if (!folder) {
                return res.status(404).json({ error: "Folder not found or not authorized" });
            }

            res.json({
                id: folder.id,
                name: folder.name,
                parentFolderId: folder.parentFolderId,
            });
        } catch (error) {
            console.error("Error moving folder:", error);
            if (error instanceof Error) {
                return res.status(400).json({ error: error.message });
            }
            res.status(500).json({ error: "Failed to move folder" });
        }
    };

    getFolderTree = async (req: Request, res: Response) => {
        try {
            if (!req.user) {
                return res.status(401).json({ error: "Authentication required" });
            }

            const folders = await this.folderService.getFolderTree(req.user.id);
            res.json(folders.map(folder => ({
                id: folder.id,
                name: folder.name,
                ownerId: folder.ownerId,
                parentFolderId: folder.parentFolderId,
                createdAt: folder.createdAt,
                updatedAt: folder.updatedAt,
            })));
        } catch (error) {
            console.error("Error getting folder tree:", error);
            res.status(500).json({ error: "Failed to get folder tree" });
        }
    };
}

