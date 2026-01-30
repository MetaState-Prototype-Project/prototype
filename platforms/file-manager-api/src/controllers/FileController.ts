import type { Request, Response } from "express";
import multer from "multer";
import archiver from "archiver";
import fs from "fs";
import path from "path";
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
    private ZIP_TEMP_DIR = process.env.ZIP_TEMP_DIR as string;
    constructor() {
        if (!this.ZIP_TEMP_DIR) {
            throw new Error("ZIP_TEMP_DIR is not set");
        }

        this.fileService = new FileService();
        
        // Ensure temp directory exists
        if (!fs.existsSync(this.ZIP_TEMP_DIR)) {
            fs.mkdirSync(this.ZIP_TEMP_DIR, { recursive: true });
        }
    }

    /**
     * Cleanup old zip files (older than 24 hours)
     */
    private cleanupOldZips() {
        try {
            const now = Date.now();
            const TTL = 24 * 60 * 60 * 1000; // 24 hours

            const files = fs.readdirSync(this.ZIP_TEMP_DIR);
            for (const file of files) {
                if (!file.startsWith('files-') || !file.endsWith('.zip')) continue;
                
                const filePath = path.join(this.ZIP_TEMP_DIR, file);
                const stats = fs.statSync(filePath);
                
                if (now - stats.mtimeMs > TTL) {
                    fs.unlinkSync(filePath);
                    console.log(`Cleaned up old zip: ${file}`);
                }
            }
        } catch (error) {
            console.error('Error cleaning up old zips:', error);
        }
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
            if (error instanceof Error && error.message.includes("signing containers")) {
                return res.status(409).json({
                    error: error.message,
                    code: "FILE_HAS_SIGNATURES",
                });
            }
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

    /**
     * Download multiple files as ZIP. Creates zip on disk then serves it.
     * Old zips (24h+) are cleaned up before creating new ones.
     */
    downloadFilesAsZip = async (req: Request, res: Response) => {
        try {
            if (!req.user) {
                return res
                    .status(401)
                    .json({ error: "Authentication required" });
            }

            // Cleanup old zips first
            this.cleanupOldZips();

            let { files, fileIds } = req.body;

            // Handle form-encoded data where files is a JSON string
            if (typeof files === 'string') {
                try {
                    files = JSON.parse(files);
                } catch {
                    return res.status(400).json({ error: "Invalid files JSON" });
                }
            }

            // Support both formats: { files: [{id, path}] } or { fileIds: [id] }
            let fileEntries: Array<{ id: string; path: string }>;
            
            if (Array.isArray(files) && files.length > 0) {
                fileEntries = files.map((f: any) => ({
                    id: typeof f === 'string' ? f : f.id,
                    path: (typeof f === 'object' && f.path) || '',
                }));
            } else if (Array.isArray(fileIds) && fileIds.length > 0) {
                fileEntries = fileIds.map((id: string) => ({ id, path: '' }));
            } else {
                return res.status(400).json({ error: "files or fileIds array is required" });
            }

            if (fileEntries.length > 500) {
                return res.status(400).json({ error: "Maximum 500 files per download" });
            }

            // Validate all file IDs are non-empty strings
            for (const entry of fileEntries) {
                if (!entry.id || typeof entry.id !== 'string' || entry.id.trim() === '') {
                    return res.status(400).json({ error: "Invalid file id in request" });
                }
            }

            // Validate all files exist and user has access
            const validatedFiles = await this.fileService.getFilesMetadataByIds(
                fileEntries.map(f => f.id),
                req.user.id
            );
            
            if (validatedFiles.length === 0) {
                return res.status(404).json({ error: "No accessible files found" });
            }

            // Create a map of id -> metadata for quick lookup
            const fileMetaMap = new Map(validatedFiles.map(f => [f.id, f]));

            // Create zip file on disk with timestamp
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
            const zipFilename = `files-${timestamp}.zip`;
            const zipPath = path.join(this.ZIP_TEMP_DIR, zipFilename);
            
            const output = fs.createWriteStream(zipPath);
            const archive = archiver('zip', {
                store: true, // No compression for speed
            });

            // Track if request was aborted
            let aborted = false;

            // Handle client disconnect
            req.on('close', () => {
                if (!res.writableEnded) {
                    aborted = true;
                    archive.abort();
                    // Delete incomplete zip
                    if (fs.existsSync(zipPath)) {
                        fs.unlinkSync(zipPath);
                    }
                    console.log('Download aborted by client');
                }
            });

            // Handle archive errors
            archive.on('error', (err: Error) => {
                if (aborted) return;
                console.error('Archive error:', err);
                // Delete failed zip
                if (fs.existsSync(zipPath)) {
                    fs.unlinkSync(zipPath);
                }
                if (!res.headersSent) {
                    res.status(500).json({ error: 'Failed to create archive' });
                }
            });

            // Pipe archive to file on disk
            archive.pipe(output);

            // Track full paths to handle duplicates
            const usedPaths = new Map<string, number>();

            // Sanitize filename to prevent zip-slip attacks
            const sanitizeFilename = (filename: string): string => {
                if (!filename) return 'file';
                
                let safe = filename;
                
                // Convert backslashes to forward slashes
                safe = safe.replace(/\\/g, '/');
                
                // Strip Windows drive letters (C:, D:, etc.)
                safe = safe.replace(/^[a-zA-Z]:/, '');
                
                // Strip any leading slashes or dots
                safe = safe.replace(/^[\/\.]+/, '');
                
                // Take only the basename (after last slash)
                const lastSlash = safe.lastIndexOf('/');
                if (lastSlash !== -1) {
                    safe = safe.slice(lastSlash + 1);
                }
                
                // Remove or replace dangerous characters
                // Keep: alphanumeric, spaces, dots, dashes, underscores, parentheses
                safe = safe.replace(/[^\w\s.\-()]/g, '_');
                
                // Collapse multiple dots to prevent .. traversal
                safe = safe.replace(/\.{2,}/g, '.');
                
                // Remove leading/trailing dots and spaces
                safe = safe.replace(/^[.\s]+|[.\s]+$/g, '');
                
                // If empty after sanitization, use default
                if (!safe) return 'file';
                
                return safe;
            };

            // Sanitize path to prevent directory traversal attacks
            const sanitizePath = (p: string): string => {
                if (!p) return '';
                
                // Normalize separators: convert backslashes to forward slashes
                let normalized = p.replace(/\\/g, '/');
                
                // Strip Windows drive letters (C:, D:, etc.)
                normalized = normalized.replace(/^[a-zA-Z]:/, '');
                
                // Strip UNC paths (//server/share or \\server\share already normalized)
                normalized = normalized.replace(/^\/\/[^/]*\/[^/]*/, '');
                
                // Strip any leading slashes
                normalized = normalized.replace(/^\/+/, '');
                
                // Split into segments and resolve . and ..
                const segments = normalized.split('/');
                const resolved: string[] = [];
                let escapedRoot = false;
                
                for (const segment of segments) {
                    // Skip empty segments and current directory references
                    if (segment === '' || segment === '.') {
                        continue;
                    }
                    
                    if (segment === '..') {
                        // Pop parent directory if possible
                        if (resolved.length > 0) {
                            resolved.pop();
                        } else {
                            // Attempted to escape root - mark as invalid
                            escapedRoot = true;
                        }
                    } else {
                        // Regular segment - add it
                        resolved.push(segment);
                    }
                }
                
                // If any attempt to escape root was detected, return empty string
                if (escapedRoot) {
                    return '';
                }
                
                return resolved.join('/');
            };

            // Stream each file into the archive one at a time
            for (const entry of fileEntries) {
                // Stop processing if client disconnected
                if (aborted) break;

                const fileMeta = fileMetaMap.get(entry.id);
                if (!fileMeta) continue; // User doesn't have access

                try {
                    const fileData = await this.fileService.getFileDataStream(entry.id, req.user.id);
                    
                    if (fileData) {
                        const sanitizedPath = sanitizePath(entry.path);
                        const baseName = sanitizeFilename(fileData.name);
                        
                        // Build full path in zip
                        let fullPath = sanitizedPath ? `${sanitizedPath}/${baseName}` : baseName;
                        
                        // Handle duplicate paths by appending a number
                        const count = usedPaths.get(fullPath) || 0;
                        if (count > 0) {
                            const ext = baseName.lastIndexOf('.');
                            let uniqueName: string;
                            if (ext > 0) {
                                uniqueName = `${baseName.slice(0, ext)} (${count})${baseName.slice(ext)}`;
                            } else {
                                uniqueName = `${baseName} (${count})`;
                            }
                            fullPath = sanitizedPath ? `${sanitizedPath}/${uniqueName}` : uniqueName;
                        }
                        usedPaths.set(sanitizedPath ? `${sanitizedPath}/${baseName}` : baseName, count + 1);

                        // Append stream to archive
                        archive.append(fileData.stream, { name: fullPath });
                    }
                } catch (fileError) {
                    console.error(`Error adding file ${entry.id} to archive:`, fileError);
                    // Continue with other files
                }
            }

            // Finalize the archive (this is when the stream ends)
            if (!aborted) {
                await archive.finalize();
                
                // Wait for file to be written
                await new Promise<void>((resolve, reject) => {
                    output.on('close', resolve);
                    output.on('error', reject);
                });

                // Send the file
                res.setHeader('Content-Type', 'application/zip');
                res.setHeader('Content-Disposition', `attachment; filename="${zipFilename}"`);
                res.setHeader('Content-Length', fs.statSync(zipPath).size.toString());
                
                const fileStream = fs.createReadStream(zipPath);
                fileStream.pipe(res);
                
                fileStream.on('error', (err) => {
                    console.error('Error streaming zip file:', err);
                    if (!res.headersSent) {
                        res.status(500).json({ error: 'Failed to send zip file' });
                    }
                });
            }

        } catch (error) {
            console.error("Error creating zip download:", error);
            if (!res.headersSent) {
                res.status(500).json({ error: "Failed to create zip download" });
            }
        }
    };
}
