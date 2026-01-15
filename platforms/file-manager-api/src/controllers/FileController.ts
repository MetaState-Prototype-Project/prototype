import type { Request, Response } from "express";
import multer from "multer";
import { FileService } from "../services/FileService";

const upload = multer({
    limits: { fileSize: 1024 * 1024 * 1024 }, // 1GB limit
    storage: multer.memoryStorage(),
});

const uploadMultiple = multer({
    limits: { fileSize: 1024 * 1024 * 1024 }, // 1GB limit
    storage: multer.memoryStorage(),
});

export class FileController {
    private fileService: FileService;

    constructor() {
        this.fileService = new FileService();
    }

    uploadFile = [
        upload.single("file"),
        async (req: Request, res: Response) => {
            try {
                if (!req.file) {
                    return res.status(400).json({ error: "No file provided" });
                }

                if (!req.user) {
                    return res
                        .status(401)
                        .json({ error: "Authentication required" });
                }

                // Check file size limit (1GB)
                const MAX_FILE_SIZE = 1024 * 1024 * 1024; // 1GB in bytes
                if (req.file.size > MAX_FILE_SIZE) {
                    return res.status(413).json({
                        error: "File size exceeds 1GB limit",
                        maxSize: MAX_FILE_SIZE,
                        fileSize: req.file.size,
                    });
                }

                // Check user's storage quota (1GB total)
                const { used, limit } =
                    await this.fileService.getUserStorageUsage(req.user.id);
                if (used + req.file.size > limit) {
                    return res.status(413).json({
                        error: "Storage quota exceeded",
                        used,
                        limit,
                        fileSize: req.file.size,
                        available: limit - used,
                    });
                }

                const { displayName, description, folderId } = req.body;

                // Normalize folderId - convert string "null" to actual null
                const normalizedFolderId =
                    folderId === "null" ||
                    folderId === "" ||
                    folderId === null ||
                    folderId === undefined
                        ? null
                        : folderId;

                const file = await this.fileService.createFile(
                    req.file.originalname,
                    req.file.mimetype,
                    req.file.size,
                    req.file.buffer,
                    req.user.id,
                    normalizedFolderId,
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
        },
    ];

    uploadFiles = [
        uploadMultiple.array("files", 50),
        async (req: Request, res: Response) => {
            try {
                const files = req.files as Express.Multer.File[];
                if (!files || files.length === 0) {
                    return res.status(400).json({ error: "No files provided" });
                }

                if (!req.user) {
                    return res
                        .status(401)
                        .json({ error: "Authentication required" });
                }

                const MAX_FILE_SIZE = 1024 * 1024 * 1024; // 1GB in bytes
                const { used, limit } =
                    await this.fileService.getUserStorageUsage(req.user.id);

                const { folderId } = req.body;
                const normalizedFolderId =
                    folderId === "null" ||
                    folderId === "" ||
                    folderId === null ||
                    folderId === undefined
                        ? null
                        : folderId;

                interface UploadResult {
                    id: string;
                    name: string;
                    displayName: string | null;
                    description: string | null;
                    mimeType: string;
                    size: number;
                    md5Hash: string;
                    folderId: string | null;
                    createdAt: Date;
                }

                interface UploadError {
                    fileName: string;
                    error: string;
                    fileSize?: number;
                    available?: number;
                }

                const results: UploadResult[] = [];
                const errors: UploadError[] = [];
                let currentUsed = used;

                if (!req.user) {
                    return res
                        .status(401)
                        .json({ error: "Authentication required" });
                }

                for (const file of files) {
                    try {
                        // Check file size limit
                        if (file.size > MAX_FILE_SIZE) {
                            errors.push({
                                fileName: file.originalname,
                                error: "File size exceeds 1GB limit",
                                fileSize: file.size,
                            });
                            continue;
                        }

                        // Check storage quota
                        if (currentUsed + file.size > limit) {
                            errors.push({
                                fileName: file.originalname,
                                error: "Storage quota exceeded",
                                available: limit - currentUsed,
                            });
                            continue;
                        }

                        const createdFile = await this.fileService.createFile(
                            file.originalname,
                            file.mimetype,
                            file.size,
                            file.buffer,
                            req.user.id,
                            normalizedFolderId,
                            undefined,
                            undefined,
                        );

                        currentUsed += file.size;
                        results.push({
                            id: createdFile.id,
                            name: createdFile.name,
                            displayName: createdFile.displayName,
                            description: createdFile.description,
                            mimeType: createdFile.mimeType,
                            size: createdFile.size,
                            md5Hash: createdFile.md5Hash,
                            folderId: createdFile.folderId,
                            createdAt: createdFile.createdAt,
                        });
                    } catch (error) {
                        console.error(
                            `Error uploading file ${file.originalname}:`,
                            error,
                        );
                        errors.push({
                            fileName: file.originalname,
                            error:
                                error instanceof Error
                                    ? error.message
                                    : "Failed to upload file",
                        });
                    }
                }

                res.status(201).json({
                    files: results,
                    errors: errors.length > 0 ? errors : undefined,
                });
            } catch (error) {
                console.error("Error uploading files:", error);
                if (error instanceof Error) {
                    return res.status(400).json({ error: error.message });
                }
                res.status(500).json({ error: "Failed to upload files" });
            }
        },
    ];

    getFiles = async (req: Request, res: Response) => {
        try {
            if (!req.user) {
                return res
                    .status(401)
                    .json({ error: "Authentication required" });
            }

            const { folderId } = req.query;
            const folderIdParam =
                folderId === "null" || folderId === ""
                    ? null
                    : (folderId as string | undefined);

            const files = await this.fileService.getUserFiles(
                req.user.id,
                folderIdParam,
            );
            res.json(
                files.map((file) => ({
                    id: file.id,
                    name: file.name,
                    displayName: file.displayName,
                    description: file.description,
                    mimeType: file.mimeType,
                    size: file.size,
                    md5Hash: file.md5Hash,
                    ownerId: file.ownerId,
                    owner: file.owner
                        ? {
                              id: file.owner.id,
                              name: file.owner.name,
                              ename: file.owner.ename,
                          }
                        : null,
                    folderId: file.folderId,
                    createdAt: file.createdAt,
                    updatedAt: file.updatedAt,
                    canPreview: this.fileService.canPreview(file.mimeType),
                })),
            );
        } catch (error) {
            console.error("Error getting files:", error);
            res.status(500).json({ error: "Failed to get files" });
        }
    };

    getFile = async (req: Request, res: Response) => {
        try {
            if (!req.user) {
                return res
                    .status(401)
                    .json({ error: "Authentication required" });
            }

            const { id } = req.params;
            const file = await this.fileService.getFileById(id, req.user.id);

            if (!file) {
                return res.status(404).json({ error: "File not found" });
            }

            // Check if user is the owner
            const isOwner = file.ownerId === req.user.id;

            // Get signatures for this file
            const signatures = await this.fileService.getFileSignatures(id);

            // Base response (available to everyone with access)
            const response: any = {
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
                signatures: signatures.map((sig) => ({
                    id: sig.id,
                    userId: sig.userId,
                    user: sig.user
                        ? {
                              id: sig.user.id,
                              name: sig.user.name,
                              ename: sig.user.ename,
                              avatarUrl: sig.user.avatarUrl,
                          }
                        : null,
                    md5Hash: sig.md5Hash,
                    signature: sig.signature,
                    publicKey: sig.publicKey,
                    message: sig.message,
                    createdAt: sig.createdAt,
                })),
            };

            // Only include tags if user is the owner
            if (isOwner) {
                response.tags = file.tags || [];
            }

            res.json(response);
        } catch (error) {
            console.error("Error getting file:", error);
            res.status(500).json({ error: "Failed to get file" });
        }
    };

    updateFile = async (req: Request, res: Response) => {
        try {
            if (!req.user) {
                return res
                    .status(401)
                    .json({ error: "Authentication required" });
            }

            const { id } = req.params;
            const { displayName, description, folderId } = req.body;

            const file = await this.fileService.updateFile(
                id,
                req.user.id,
                displayName,
                description,
                folderId !== undefined
                    ? folderId === "null" || folderId === ""
                        ? null
                        : folderId
                    : undefined,
            );

            if (!file) {
                return res
                    .status(404)
                    .json({ error: "File not found or not authorized" });
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
                return res
                    .status(401)
                    .json({ error: "Authentication required" });
            }

            const { id } = req.params;
            const file = await this.fileService.getFileById(id, req.user.id);

            if (!file) {
                return res.status(404).json({ error: "File not found" });
            }

            res.setHeader("Content-Type", file.mimeType);
            res.setHeader(
                "Content-Disposition",
                `attachment; filename="${file.name}"`,
            );
            res.setHeader("Content-Length", file.size.toString());
            res.send(file.data);
        } catch (error) {
            console.error("Error downloading file:", error);
            res.status(500).json({ error: "Failed to download file" });
        }
    };

    previewFile = async (req: Request, res: Response) => {
        try {
            if (!req.user) {
                return res
                    .status(401)
                    .json({ error: "Authentication required" });
            }

            const { id } = req.params;
            const file = await this.fileService.getFileById(id, req.user.id);

            if (!file) {
                return res.status(404).json({ error: "File not found" });
            }

            if (!this.fileService.canPreview(file.mimeType)) {
                return res
                    .status(400)
                    .json({ error: "File type cannot be previewed" });
            }

            res.setHeader("Content-Type", file.mimeType);
            res.setHeader(
                "Content-Disposition",
                `inline; filename="${file.name}"`,
            );
            res.setHeader("Content-Length", file.size.toString());
            res.send(file.data);
        } catch (error) {
            console.error("Error previewing file:", error);
            res.status(500).json({ error: "Failed to preview file" });
        }
    };

    deleteFile = async (req: Request, res: Response) => {
        try {
            if (!req.user) {
                return res
                    .status(401)
                    .json({ error: "Authentication required" });
            }

            const { id } = req.params;
            const deleted = await this.fileService.deleteFile(id, req.user.id);

            if (!deleted) {
                return res
                    .status(404)
                    .json({ error: "File not found or not authorized" });
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
                return res
                    .status(401)
                    .json({ error: "Authentication required" });
            }

            const { id } = req.params;
            const file = await this.fileService.getFileById(id, req.user.id);

            if (!file) {
                return res.status(404).json({ error: "File not found" });
            }

            const signatures = await this.fileService.getFileSignatures(id);

            res.json(
                signatures.map((sig) => ({
                    id: sig.id,
                    userId: sig.userId,
                    user: sig.user
                        ? {
                              id: sig.user.id,
                              name: sig.user.name,
                              ename: sig.user.ename,
                              avatarUrl: sig.user.avatarUrl,
                          }
                        : null,
                    md5Hash: sig.md5Hash,
                    message: sig.message,
                    signature: sig.signature,
                    publicKey: sig.publicKey,
                    createdAt: sig.createdAt,
                })),
            );
        } catch (error) {
            console.error("Error getting file signatures:", error);
            res.status(500).json({ error: "Failed to get signatures" });
        }
    };

    moveFile = async (req: Request, res: Response) => {
        try {
            if (!req.user) {
                return res
                    .status(401)
                    .json({ error: "Authentication required" });
            }

            const { id } = req.params;
            const { folderId } = req.body;
            const folderIdParam =
                folderId === "null" || folderId === ""
                    ? null
                    : (folderId as string | null);

            const file = await this.fileService.moveFile(
                id,
                folderIdParam,
                req.user.id,
            );

            if (!file) {
                return res
                    .status(404)
                    .json({ error: "File not found or not authorized" });
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

    getStorageUsage = async (req: Request, res: Response) => {
        try {
            if (!req.user) {
                return res
                    .status(401)
                    .json({ error: "Authentication required" });
            }

            const usage = await this.fileService.getUserStorageUsage(
                req.user.id,
            );
            res.json(usage);
        } catch (error) {
            console.error("Error getting storage usage:", error);
            res.status(500).json({ error: "Failed to get storage usage" });
        }
    };
}
