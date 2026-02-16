import { AppDataSource } from "../database/data-source";
import { File } from "../database/entities/File";
import { Folder } from "../database/entities/Folder";
import { FileAccess } from "../database/entities/FileAccess";
import { FolderAccess } from "../database/entities/FolderAccess";
import { SignatureContainer } from "../database/entities/SignatureContainer";
import { In, IsNull, Not } from "typeorm";
import crypto from "crypto";
import { Readable } from "stream";

/** Soft-delete marker: file is hidden and syncs to eSigner so they can hide it too (no delete webhook). */
export const SOFT_DELETED_FILE_NAME = "[[deleted]]";

export class FileService {
    private fileRepository = AppDataSource.getRepository(File);
    private fileAccessRepository = AppDataSource.getRepository(FileAccess);
    private folderRepository = AppDataSource.getRepository(Folder);
    private signatureRepository = AppDataSource.getRepository(SignatureContainer);

    async calculateMD5(buffer: Buffer): Promise<string> {
        return crypto.createHash('md5').update(buffer).digest('hex');
    }

    async createFile(
        name: string,
        mimeType: string,
        size: number,
        data: Buffer,
        ownerId: string,
        folderId?: string | null,
        displayName?: string,
        description?: string
    ): Promise<File> {
        const md5Hash = await this.calculateMD5(data);
        
        // Normalize folderId - convert string "null" to actual null
        const normalizedFolderId = folderId === 'null' || folderId === '' || folderId === null || folderId === undefined ? null : folderId;
        
        // Verify folder exists and user owns it if folderId is provided
        if (normalizedFolderId) {
            const folder = await this.folderRepository.findOne({
                where: { id: normalizedFolderId, ownerId },
            });
            if (!folder) {
                throw new Error("Folder not found or user is not the owner");
            }
        }
        
        const fileData: Partial<File> = {
            name,
            displayName: displayName || name,
            mimeType,
            size,
            md5Hash,
            data,
            ownerId,
            folderId: normalizedFolderId,
        };

        if (description !== undefined) {
            fileData.description = description || null;
        }

        const file = this.fileRepository.create(fileData);
        const savedFile = await this.fileRepository.save(file);
        return savedFile;
    }

    async getFileById(id: string, userId: string): Promise<File | null> {
        const file = await this.fileRepository.findOne({
            where: { id },
            relations: ["owner", "folder", "signatures", "signatures.user", "tags"],
        });

        if (!file || file.name === SOFT_DELETED_FILE_NAME) {
            return null;
        }

        // Check access: owner or has access permission
        if (file.ownerId === userId) {
            return file;
        }
        
        // Check for direct file access
        const access = await this.fileAccessRepository.findOne({
            where: { fileId: id, userId },
        });
        
        if (access) {
            return file;
        }

        // Check if user has access via parent folder (if file is in a folder)
        if (file.folderId) {
            const hasAccessViaParent = await this.hasAccessViaParentFolder(file.folderId, userId);
            if (hasAccessViaParent) {
                return file;
            }
        }

        return null;
    }

    async getUserFiles(userId: string, folderId?: string | null): Promise<File[]> {
        // Get files owned by user
        // Explicitly check for null or undefined to get root-level files
        let ownedFiles: File[];
        
        if (folderId === null || folderId === undefined || folderId === 'null' || folderId === '') {
            // Root level files (no folder) - folderId must be null; exclude soft-deleted
            ownedFiles = await this.fileRepository.find({
                where: {
                    ownerId: userId,
                    folderId: IsNull(),
                    name: Not(SOFT_DELETED_FILE_NAME),
                },
                relations: ["owner", "folder", "tags"],
                order: { createdAt: "DESC" },
            });
        } else {
            ownedFiles = await this.fileRepository.find({
                where: {
                    ownerId: userId,
                    folderId: folderId,
                    name: Not(SOFT_DELETED_FILE_NAME),
                },
                relations: ["owner", "folder", "tags"],
                order: { createdAt: "DESC" },
            });
        }

        // Get files where user has access
        const accessedFiles = await this.fileAccessRepository.find({
            where: { userId },
            relations: ["file", "file.owner", "file.folder", "file.tags"],
        });

        // Get files from folders the user has access to (only direct children to preserve hierarchy)
        let folderAccessFiles: File[] = [];
        if (folderId && folderId !== 'null' && folderId !== '') {
            const folderAccessRepository = AppDataSource.getRepository(FolderAccess);
            
            // Check if user has direct access to this folder OR access to any parent folder
            const directAccess = await folderAccessRepository.findOne({
                where: { folderId, userId },
            });
            
            // Also check if user has access to any parent folder (recursive check)
            let hasAccessViaParent = false;
            if (!directAccess) {
                hasAccessViaParent = await this.hasAccessViaParentFolder(folderId, userId);
            }
            
            if (directAccess || hasAccessViaParent) {
                folderAccessFiles = await this.fileRepository.find({
                    where: { folderId, name: Not(SOFT_DELETED_FILE_NAME) },
                    relations: ["owner", "folder", "tags"],
                    order: { createdAt: "DESC" },
                });
            }
        }

        const ownedFileIds = new Set(ownedFiles.map(f => f.id));
        const allFiles = [...ownedFiles];

        // Add accessed files that aren't already in the list and match folder filter (exclude soft-deleted)
        for (const fileAccess of accessedFiles) {
            if (!fileAccess.file || fileAccess.file.name === SOFT_DELETED_FILE_NAME) continue;

            // Skip if already in owned files
            if (ownedFileIds.has(fileAccess.fileId)) continue;
            
            // Filter by folder if specified
            if (folderId === null || folderId === undefined || folderId === 'null' || folderId === '') {
                // When viewing root, show ALL shared files regardless of their folder location
                // This allows users to see all shared files in the "Shared with me" view
                allFiles.push(fileAccess.file);
            } else {
                // Only add files in the specified folder
                if (fileAccess.file.folderId === folderId) {
                    allFiles.push(fileAccess.file);
                }
            }
        }

        // Add files from folders the user has access to
        for (const file of folderAccessFiles) {
            if (!ownedFileIds.has(file.id) && !allFiles.find(f => f.id === file.id)) {
                allFiles.push(file);
            }
        }

        return allFiles;
    }

    async updateFile(
        id: string,
        userId: string,
        displayName?: string,
        description?: string,
        folderId?: string | null
    ): Promise<File | null> {
        const file = await this.fileRepository.findOne({
            where: { id, ownerId: userId },
        });

        if (!file) {
            return null;
        }

        if (displayName !== undefined) {
            file.displayName = displayName || null;
        }
        if (description !== undefined) {
            file.description = description || null;
        }
        if (folderId !== undefined) {
            // Verify folder exists and user owns it if folderId is provided
            if (folderId) {
                const folder = await this.folderRepository.findOne({
                    where: { id: folderId, ownerId: userId },
                });
                if (!folder) {
                    throw new Error("Folder not found or user is not the owner");
                }
            }
            file.folderId = folderId;
        }

        return await this.fileRepository.save(file);
    }

    async deleteFile(id: string, userId: string): Promise<boolean> {
        const file = await this.fileRepository.findOne({
            where: { id, ownerId: userId },
        });

        if (!file) {
            return false;
        }

        const signatureCount = await this.signatureRepository.count({
            where: { fileId: id },
        });
        if (signatureCount > 0) {
            throw new Error(
                "File cannot be deleted because it is part of one or more signing containers",
            );
        }

        // Soft-delete: set name so sync (update) propagates to eSigner; no delete webhook exists.
        // File is hidden from lists and getFileById in both platforms.
        await this.fileAccessRepository.delete({ fileId: id });
        file.name = SOFT_DELETED_FILE_NAME;
        file.displayName = SOFT_DELETED_FILE_NAME;
        await this.fileRepository.save(file);
        return true;
    }

    async moveFile(fileId: string, folderId: string | null, userId: string): Promise<File | null> {
        return await this.updateFile(fileId, userId, undefined, undefined, folderId);
    }

    canPreview(mimeType: string): boolean {
        // Check if file type can be previewed (images and PDFs)
        const imageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
        const pdfTypes = ['application/pdf'];
        return imageTypes.includes(mimeType) || pdfTypes.includes(mimeType);
    }

    async getFileSignatures(fileId: string): Promise<SignatureContainer[]> {
        return await this.signatureRepository.find({
            where: { fileId },
            relations: ["user"],
            order: { createdAt: "ASC" },
        });
    }

    /**
     * Check if user has access to a folder via any parent folder (recursive check)
     */
    private async hasAccessViaParentFolder(folderId: string, userId: string, visited: Set<string> = new Set()): Promise<boolean> {
        // Prevent infinite loops
        if (visited.has(folderId)) {
            return false;
        }
        visited.add(folderId);

        const folderRepository = AppDataSource.getRepository(Folder);
        const folderAccessRepository = AppDataSource.getRepository(FolderAccess);
        
        // Walk up the folder tree all the way to root, checking each level
        let currentFolderId: string | null = folderId;
        
        while (currentFolderId) {
            const folder = await folderRepository.findOne({
                where: { id: currentFolderId },
                select: ["id", "parentFolderId", "ownerId"],
            });

            if (!folder) {
                break;
            }

            // Check if user owns this folder in the path
            if (folder.ownerId === userId) {
                return true;
            }

            // Check if user has access to this folder in the path
            const access = await folderAccessRepository.findOne({
                where: { folderId: currentFolderId, userId },
            });

            if (access) {
                return true;
            }

            // Move to parent folder
            currentFolderId = folder.parentFolderId;
            
            // Prevent infinite loops
            if (currentFolderId && visited.has(currentFolderId)) {
                break;
            }
            if (currentFolderId) {
                visited.add(currentFolderId);
            }
        }

        return false;
    }

    async getUserStorageUsage(userId: string): Promise<{ used: number; limit: number; fileCount: number; folderCount: number }> {
        const FOLDER_SIZE = 4 * 1024; // 4KB per folder

        // Get sum of all file sizes and count
        const fileResult = await this.fileRepository
            .createQueryBuilder('file')
            .select('COALESCE(SUM(CAST(file.size AS BIGINT)), 0)', 'totalSize')
            .addSelect('COUNT(file.id)', 'fileCount')
            .where('file.ownerId = :userId', { userId })
            .getRawOne();

        // Count all folders
        const folderResult = await this.folderRepository
            .createQueryBuilder('folder')
            .select('COUNT(folder.id)', 'folderCount')
            .where('folder.ownerId = :userId', { userId })
            .getRawOne();

        const fileSize = Number(fileResult?.totalSize || 0);
        const fileCount = Number(fileResult?.fileCount || 0);
        const folderCount = Number(folderResult?.folderCount || 0);
        const folderSize = folderCount * FOLDER_SIZE;

        const used = fileSize + folderSize;
        const limit = 1073741824; // 1GB in bytes

        return { used, limit, fileCount, folderCount };
    }

    /**
     * Get file metadata without the data blob (for bulk operations)
     */
    async getFileMetadataById(id: string, userId: string): Promise<Omit<File, 'data'> | null> {
        const file = await this.fileRepository.findOne({
            where: { id },
            select: ["id", "name", "displayName", "mimeType", "size", "md5Hash", "ownerId", "folderId", "createdAt", "updatedAt"],
        });

        if (!file || file.name === SOFT_DELETED_FILE_NAME) {
            return null;
        }

        // Check access: owner or has access permission
        if (file.ownerId === userId) {
            return file;
        }
        
        // Check for direct file access
        const access = await this.fileAccessRepository.findOne({
            where: { fileId: id, userId },
        });
        
        if (access) {
            return file;
        }

        // Check if user has access via parent folder (if file is in a folder)
        if (file.folderId) {
            const hasAccessViaParent = await this.hasAccessViaParentFolder(file.folderId, userId);
            if (hasAccessViaParent) {
                return file;
            }
        }

        return null;
    }

    /**
     * Stream file data as a Readable stream (fetches data blob separately)
     * This avoids loading the entire file into memory at once for the caller,
     * though the DB query still loads it. For true streaming, you'd need
     * PostgreSQL large objects or file system storage.
     */
    async getFileDataStream(id: string, userId: string): Promise<{ stream: Readable; size: number; name: string; mimeType: string } | null> {
        // First verify access with metadata only
        const metadata = await this.getFileMetadataById(id, userId);
        if (!metadata) {
            return null;
        }

        // Fetch only the data column
        const result = await this.fileRepository
            .createQueryBuilder('file')
            .select('file.data')
            .where('file.id = :id', { id })
            .getRawOne();

        if (!result || !result.file_data) {
            return null;
        }

        // Convert Buffer to Readable stream
        const stream = Readable.from(result.file_data);

        return {
            stream,
            size: Number(metadata.size),
            name: metadata.displayName || metadata.name,
            mimeType: metadata.mimeType,
        };
    }

    /**
     * Get multiple files' metadata by IDs (for bulk download validation)
     */
    async getFilesMetadataByIds(ids: string[], userId: string): Promise<Array<Omit<File, 'data'>>> {
        const files: Array<Omit<File, 'data'>> = [];
        for (const id of ids) {
            const file = await this.getFileMetadataById(id, userId);
            if (file) {
                files.push(file);
            }
        }
        return files;
    }
}

