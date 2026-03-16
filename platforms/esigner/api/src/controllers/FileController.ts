import { Request, Response } from "express";
import { FileService, ReservedFileNameError } from "../services/FileService";
import multer from "multer";
import { v4 as uuidv4 } from "uuid";

export const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB limit

const upload = multer({
    limits: { fileSize: MAX_FILE_SIZE },
    storage: multer.memoryStorage(),
});

export class FileController {
    private fileService: FileService;

    constructor() {
        this.fileService = new FileService();
    }

    presignUpload = async (req: Request, res: Response) => {
        try {
            if (!req.user) {
                return res.status(401).json({ error: "Authentication required" });
            }

            const { filename, mimeType, size } = req.body;

            if (!filename || !mimeType || !size) {
                return res.status(400).json({ error: "filename, mimeType, and size are required" });
            }

            const fileId = uuidv4();
            const key = this.fileService.s3Service.generateKey(req.user.id, fileId, filename);
            const uploadUrl = await this.fileService.s3Service.generateUploadUrl(key, mimeType);

            res.json({ uploadUrl, key, fileId });
        } catch (error) {
            console.error("Error generating presigned URL:", error);
            res.status(500).json({ error: "Failed to generate upload URL" });
        }
    };

    confirmUpload = async (req: Request, res: Response) => {
        try {
            if (!req.user) {
                return res.status(401).json({ error: "Authentication required" });
            }

            const { key, fileId, filename, mimeType, size, displayName, description } = req.body;

            if (!key || !fileId || !filename || !mimeType || !size) {
                return res.status(400).json({ error: "key, fileId, filename, mimeType, and size are required" });
            }

            const head = await this.fileService.s3Service.headObject(key);
            const md5Hash = head.etag;
            const url = this.fileService.s3Service.getPublicUrl(key);

            const file = await this.fileService.createFileWithUrl(
                fileId,
                filename,
                mimeType,
                size,
                md5Hash,
                url,
                req.user.id,
                displayName,
                description,
            );

            res.status(201).json({
                id: file.id,
                name: file.name,
                displayName: file.displayName,
                description: file.description,
                mimeType: file.mimeType,
                size: file.size,
                md5Hash: file.md5Hash,
                url: file.url,
                createdAt: file.createdAt,
            });
        } catch (error) {
            console.error("Error confirming upload:", error);
            if (error instanceof ReservedFileNameError) {
                return res.status(400).json({ error: error.message });
            }
            if (error instanceof Error) {
                return res.status(400).json({ error: error.message });
            }
            res.status(500).json({ error: "Failed to confirm upload" });
        }
    };

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

                const { displayName, description } = req.body;

                const file = await this.fileService.createFile(
                    req.file.originalname,
                    req.file.mimetype,
                    req.file.size,
                    req.file.buffer,
                    req.user.id,
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
                    createdAt: file.createdAt,
                });
            } catch (error) {
                if (error instanceof ReservedFileNameError) {
                    return res.status(400).json({ error: error.message });
                }
                console.error("Error uploading file:", error);
                res.status(500).json({ error: "Failed to upload file" });
            }
        }
    ];

    getFiles = async (req: Request, res: Response) => {
        try {
            if (!req.user) {
                return res.status(401).json({ error: "Authentication required" });
            }

            const list = req.query.list as string | undefined;
            const listMode = list === "all" ? "all" : "containers";
            const documents = await this.fileService.getDocumentsWithStatus(req.user.id, listMode);
            res.json(documents);
        } catch (error) {
            console.error("Error getting documents:", error);
            res.status(500).json({ error: "Failed to get documents" });
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
                url: file.url,
                ownerId: file.ownerId,
                createdAt: file.createdAt,
                updatedAt: file.updatedAt,
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
            const { displayName, description } = req.body;

            const file = await this.fileService.updateFile(
                id,
                req.user.id,
                displayName,
                description
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
                createdAt: file.createdAt,
                updatedAt: file.updatedAt,
            });
        } catch (error) {
            console.error("Error updating file:", error);
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

            if (file.url) {
                return res.redirect(file.url);
            }

            // Legacy fallback for files still in DB
            res.setHeader('Content-Type', file.mimeType);
            res.setHeader('Content-Disposition', `attachment; filename="${file.name}"`);
            res.setHeader('Content-Length', file.size.toString());
            res.send(file.data);
        } catch (error) {
            console.error("Error downloading file:", error);
            res.status(500).json({ error: "Failed to download file" });
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

    getFileSignatures = async (req: Request, res: Response) => {
        try {
            if (!req.user) {
                return res.status(401).json({ error: "Authentication required" });
            }

            const { fileId } = req.params;
            const file = await this.fileService.getFileById(fileId, req.user.id);

            if (!file) {
                return res.status(404).json({ error: "File not found" });
            }

            const signatures = await this.fileService.getFileSignatures(fileId);

            res.json(signatures.map(sig => ({
                id: sig.id,
                userId: sig.userId,
                fileSigneeId: sig.fileSigneeId || null,
                user: sig.user ? {
                    id: sig.user.id,
                    name: sig.user.name,
                    ename: sig.user.ename,
                    avatarUrl: sig.user.avatarUrl,
                } : null,
                md5Hash: sig.md5Hash,
                message: sig.message,
                signature: sig.signature,
                publicKey: sig.publicKey,
                createdAt: sig.createdAt,
            })));
        } catch (error) {
            console.error("Error getting file signatures:", error);
            res.status(500).json({ error: "Failed to get signatures" });
        }
    };
}

