import { Request, Response } from "express";
import { FileService } from "../services/FileService";
import multer from "multer";

const upload = multer({
    limits: { fileSize: 100 * 1024 * 1024 }, // 100MB limit
    storage: multer.memoryStorage(),
});

export class FileController {
    private fileService: FileService;

    constructor() {
        this.fileService = new FileService();
    }

    uploadFile = [
        upload.single('file'),
        async (req: Request, res: Response) => {
            try {
                if (!req.file) {
                    return res.status(400).json({ error: "No file provided" });
                }

                if (!req.user) {
                    return res.status(401).json({ error: "Authentication required" });
                }

                const { displayName, description, folderId } = req.body;

                const file = await this.fileService.createFile(
                    req.file.originalname,
                    req.file.mimetype,
                    req.file.size,
                    req.file.buffer,
                    req.user.id,
                    folderId || null,
                    displayName,
                    description
                );

                res.status(201).json({
                    id: file.id,
                    name: file.name,
                    displayName: file.displayName,
                    description: file.description,
                    mimeType: file.mimeType,
                    size: file.size,
                    md5Hash: file.md5Hash,
                    folderId: file.folderId,
                    createdAt: file.createdAt,
                });
            } catch (error) {
                console.error("Error uploading file:", error);
                if (error instanceof Error) {
                    return res.status(400).json({ error: error.message });
                }
                res.status(500).json({ error: "Failed to upload file" });
            }
        }
    ];

    getFiles = async (req: Request, res: Response) => {
        try {
            if (!req.user) {
                return res.status(401).json({ error: "Authentication required" });
            }

            const { folderId } = req.query;
            const folderIdParam = folderId === 'null' || folderId === '' ? null : folderId as string | undefined;

            const files = await this.fileService.getUserFiles(req.user.id, folderIdParam);
            res.json(files.map(file => ({
                id: file.id,
                name: file.name,
                displayName: file.displayName,
                description: file.description,
                mimeType: file.mimeType,
                size: file.size,
                md5Hash: file.md5Hash,
                ownerId: file.ownerId,
                folderId: file.folderId,
                createdAt: file.createdAt,
                updatedAt: file.updatedAt,
                canPreview: this.fileService.canPreview(file.mimeType),
            })));
        } catch (error) {
            console.error("Error getting files:", error);
            res.status(500).json({ error: "Failed to get files" });
        }
    };

    getFile = async (req: Request, res: Response) => {
        try {
            if (!req.user) {
                return res.status(401).json({ error: "Authentication required" });
            }

            const { id } = req.params;
            const file = await this.fileService.getFileById(id, req.user.id);

            if (!file) {
                return res.status(404).json({ error: "File not found" });
            }

            res.json({
                id: file.id,
                name: file.name,
                displayName: file.displayName,
                description: file.description,
                mimeType: file.mimeType,
                size: file.size,
                md5Hash: file.md5Hash,
                ownerId: file.ownerId,
                folderId: file.folderId,
                createdAt: file.createdAt,
                updatedAt: file.updatedAt,
                canPreview: this.fileService.canPreview(file.mimeType),
                tags: file.tags || [],
            });
        } catch (error) {
            console.error("Error getting file:", error);
            res.status(500).json({ error: "Failed to get file" });
        }
    };

    updateFile = async (req: Request, res: Response) => {
        try {
            if (!req.user) {
                return res.status(401).json({ error: "Authentication required" });
            }

            const { id } = req.params;
            const { displayName, description, folderId } = req.body;

            const file = await this.fileService.updateFile(
                id,
                req.user.id,
                displayName,
                description,
                folderId !== undefined ? (folderId === 'null' || folderId === '' ? null : folderId) : undefined
            );

            if (!file) {
                return res.status(404).json({ error: "File not found or not authorized" });
            }

            res.json({
                id: file.id,
                name: file.name,
                displayName: file.displayName,
                description: file.description,
                mimeType: file.mimeType,
                size: file.size,
                md5Hash: file.md5Hash,
                ownerId: file.ownerId,
                folderId: file.folderId,
                createdAt: file.createdAt,
                updatedAt: file.updatedAt,
            });
        } catch (error) {
            console.error("Error updating file:", error);
            if (error instanceof Error) {
                return res.status(400).json({ error: error.message });
            }
            res.status(500).json({ error: "Failed to update file" });
        }
    };

    downloadFile = async (req: Request, res: Response) => {
        try {
            if (!req.user) {
                return res.status(401).json({ error: "Authentication required" });
            }

            const { id } = req.params;
            const file = await this.fileService.getFileById(id, req.user.id);

            if (!file) {
                return res.status(404).json({ error: "File not found" });
            }

            res.setHeader('Content-Type', file.mimeType);
            res.setHeader('Content-Disposition', `attachment; filename="${file.name}"`);
            res.setHeader('Content-Length', file.size.toString());
            res.send(file.data);
        } catch (error) {
            console.error("Error downloading file:", error);
            res.status(500).json({ error: "Failed to download file" });
        }
    };

    previewFile = async (req: Request, res: Response) => {
        try {
            if (!req.user) {
                return res.status(401).json({ error: "Authentication required" });
            }

            const { id } = req.params;
            const file = await this.fileService.getFileById(id, req.user.id);

            if (!file) {
                return res.status(404).json({ error: "File not found" });
            }

            if (!this.fileService.canPreview(file.mimeType)) {
                return res.status(400).json({ error: "File type cannot be previewed" });
            }

            res.setHeader('Content-Type', file.mimeType);
            res.setHeader('Content-Disposition', `inline; filename="${file.name}"`);
            res.setHeader('Content-Length', file.size.toString());
            res.send(file.data);
        } catch (error) {
            console.error("Error previewing file:", error);
            res.status(500).json({ error: "Failed to preview file" });
        }
    };

    deleteFile = async (req: Request, res: Response) => {
        try {
            if (!req.user) {
                return res.status(401).json({ error: "Authentication required" });
            }

            const { id } = req.params;
            const deleted = await this.fileService.deleteFile(id, req.user.id);

            if (!deleted) {
                return res.status(404).json({ error: "File not found or not authorized" });
            }

            res.json({ message: "File deleted successfully" });
        } catch (error) {
            console.error("Error deleting file:", error);
            res.status(500).json({ error: "Failed to delete file" });
        }
    };

    moveFile = async (req: Request, res: Response) => {
        try {
            if (!req.user) {
                return res.status(401).json({ error: "Authentication required" });
            }

            const { id } = req.params;
            const { folderId } = req.body;
            const folderIdParam = folderId === 'null' || folderId === '' ? null : folderId as string | null;

            const file = await this.fileService.moveFile(id, folderIdParam, req.user.id);

            if (!file) {
                return res.status(404).json({ error: "File not found or not authorized" });
            }

            res.json({
                id: file.id,
                name: file.name,
                folderId: file.folderId,
            });
        } catch (error) {
            console.error("Error moving file:", error);
            if (error instanceof Error) {
                return res.status(400).json({ error: error.message });
            }
            res.status(500).json({ error: "Failed to move file" });
        }
    };
}

