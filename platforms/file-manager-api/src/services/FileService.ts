import { AppDataSource } from "../database/data-source";
import { File } from "../database/entities/File";
import { Folder } from "../database/entities/Folder";
import { FileAccess } from "../database/entities/FileAccess";
import { SignatureContainer } from "../database/entities/SignatureContainer";
import { In, IsNull } from "typeorm";
import crypto from "crypto";

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

        if (!file) {
            return null;
        }

        // Check access: owner or has access permission
        if (file.ownerId === userId) {
            return file;
        }
        
        const access = await this.fileAccessRepository.findOne({
            where: { fileId: id, userId },
        });
        
        if (!access) {
            return null;
        }

        return file;
    }

    async getUserFiles(userId: string, folderId?: string | null): Promise<File[]> {
        // Get files owned by user
        // Explicitly check for null or undefined to get root-level files
        let ownedFiles: File[];
        
        if (folderId === null || folderId === undefined || folderId === 'null' || folderId === '') {
            // Root level files (no folder) - folderId must be null
            // Use IsNull() for proper NULL checking in TypeORM
            ownedFiles = await this.fileRepository.find({
                where: {
                    ownerId: userId,
                    folderId: IsNull()
                },
                relations: ["owner", "folder", "tags"],
                order: { createdAt: "DESC" },
            });
        } else {
            // Files in specific folder
            ownedFiles = await this.fileRepository.find({
                where: {
                    ownerId: userId,
                    folderId: folderId
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

        const ownedFileIds = new Set(ownedFiles.map(f => f.id));
        const allFiles = [...ownedFiles];

        // Add accessed files that aren't already in the list and match folder filter
        for (const fileAccess of accessedFiles) {
            if (!fileAccess.file) continue;
            
            // Skip if already in owned files
            if (ownedFileIds.has(fileAccess.fileId)) continue;
            
            // Filter by folder if specified
            if (folderId === null || folderId === undefined || folderId === 'null' || folderId === '') {
                // Only add root-level files (folderId is null)
                if (fileAccess.file.folderId === null) {
                    allFiles.push(fileAccess.file);
                }
            } else {
                // Only add files in the specified folder
                if (fileAccess.file.folderId === folderId) {
                    allFiles.push(fileAccess.file);
                }
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

        // Delete all access records
        await this.fileAccessRepository.delete({ fileId: id });

        await this.fileRepository.remove(file);
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
}

