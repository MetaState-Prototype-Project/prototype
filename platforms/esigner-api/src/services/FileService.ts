import { AppDataSource } from "../database/data-source";
import { File } from "../database/entities/File";
import { FileSignee } from "../database/entities/FileSignee";
import { SignatureContainer } from "../database/entities/SignatureContainer";
import crypto from "crypto";

/** Soft-deleted marker from File Manager (no delete webhook); hide these in eSigner. */
export const SOFT_DELETED_FILE_NAME = "[[deleted]]";

/** Thrown when name is the reserved soft-delete sentinel. */
export class ReservedFileNameError extends Error {
    constructor(name: string) {
        super(`File name '${name}' is reserved and cannot be used for upload or rename.`);
        this.name = "ReservedFileNameError";
    }
}

export class FileService {
    private fileRepository = AppDataSource.getRepository(File);
    private fileSigneeRepository = AppDataSource.getRepository(FileSignee);
    private signatureRepository = AppDataSource.getRepository(SignatureContainer);

    /**
     * Validates that the given filename is not the reserved soft-delete sentinel.
     * Call this at create/upload and rename entry points before persisting file.name.
     * @throws ReservedFileNameError if name equals SOFT_DELETED_FILE_NAME
     */
    validateFileName(name: string): void {
        if (name === SOFT_DELETED_FILE_NAME) {
            throw new ReservedFileNameError(name);
        }
    }

    async calculateMD5(buffer: Buffer): Promise<string> {
        return crypto.createHash('md5').update(buffer).digest('hex');
    }

    async createFile(
        name: string,
        mimeType: string,
        size: number,
        data: Buffer,
        ownerId: string,
        displayName?: string,
        description?: string
    ): Promise<File> {
        this.validateFileName(name);

        const md5Hash = await this.calculateMD5(data);
        
        const fileData: Partial<File> = {
            name,
            displayName: displayName || name, // Default to file name if not provided
            mimeType,
            size,
            md5Hash,
            data,
            ownerId,
        };

        if (description !== undefined) {
            fileData.description = description || null;
        }

        const file = this.fileRepository.create(fileData);
        const savedFile = await this.fileRepository.save(file);
        return savedFile;
    }

    async getFileById(id: string, userId?: string): Promise<File | null> {
        const file = await this.fileRepository.findOne({
            where: { id },
            relations: ["owner", "signees", "signees.user", "signatures", "signatures.user"],
        });

        if (!file || file.name === SOFT_DELETED_FILE_NAME) {
            return null;
        }

        // Check access: owner or invited signee
        if (userId) {
            if (file.ownerId === userId) {
                return file;
            }
            
            const signee = await this.fileSigneeRepository.findOne({
                where: { fileId: id, userId },
            });
            
            if (!signee) {
                return null;
            }
        }

        return file;
    }

    async getUserFiles(userId: string): Promise<File[]> {
        const ownedFiles = await this.fileRepository.find({
            where: { ownerId: userId },
            relations: ["owner", "signees", "signees.user", "signatures", "signatures.user"],
            order: { createdAt: "DESC" },
        });

        const invitedFiles = await this.fileSigneeRepository.find({
            where: { userId },
            relations: ["file", "file.owner", "file.signees", "file.signees.user", "file.signatures", "file.signatures.user"],
        });

        const invitedFileIds = new Set(invitedFiles.map(fs => fs.fileId));
        const allFiles = [...ownedFiles];

        for (const fileSignee of invitedFiles) {
            if (!invitedFileIds.has(fileSignee.fileId) || !ownedFiles.find(f => f.id === fileSignee.fileId)) {
                if (fileSignee.file && fileSignee.file.name !== SOFT_DELETED_FILE_NAME) {
                    allFiles.push(fileSignee.file);
                }
            }
        }

        // Sort by creation time, newest first (so new files from others appear at top)
        allFiles.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

        // Hide soft-deleted (File Manager delete workaround: name [[deleted]])
        return allFiles.filter((f) => f.name !== SOFT_DELETED_FILE_NAME);
    }

    async getDocumentsWithStatus(userId: string, listMode: 'containers' | 'all' = 'containers') {
        const files = await this.getUserFiles(userId);

        // Ensure we have all relations loaded
        const filesWithRelations = await Promise.all(
            files.map(async (file) => {
                // Reload with all necessary relations if not already loaded
                if (!file.signees || !file.signatures) {
                    return await this.fileRepository.findOne({
                        where: { id: file.id },
                        relations: ["owner", "signees", "signees.user", "signatures", "signatures.user"],
                    }) || file;
                }
                return file;
            })
        );

        // When listing only containers, exclude files that were never used as a signing container (no signees).
        // This prevents File Manager uploads from appearing as draft containers in eSigner.
        const toList = listMode === 'containers'
            ? filesWithRelations.filter((f) => (f.signees?.length ?? 0) > 0)
            : filesWithRelations;

        return toList.map(file => {
            const totalSignees = file.signees?.length || 0;
            const signedCount = file.signees?.filter(s => s.status === 'signed').length || 0;
            const pendingCount = file.signees?.filter(s => s.status === 'pending').length || 0;
            const declinedCount = file.signees?.filter(s => s.status === 'declined').length || 0;
            
            // Determine status
            let status: 'draft' | 'pending' | 'partially_signed' | 'fully_signed' = 'draft';
            if (totalSignees === 0) {
                status = 'draft';
            } else if (signedCount === 0 && pendingCount > 0) {
                status = 'pending';
            } else if (signedCount > 0 && signedCount < totalSignees) {
                status = 'partially_signed';
            } else if (signedCount === totalSignees && totalSignees > 0) {
                status = 'fully_signed';
            }

            return {
                id: file.id,
                name: file.name,
                displayName: file.displayName,
                description: file.description,
                mimeType: file.mimeType,
                size: file.size,
                md5Hash: file.md5Hash,
                ownerId: file.ownerId,
                owner: file.owner ? {
                    id: file.owner.id,
                    name: file.owner.name,
                    ename: file.owner.ename,
                } : null,
                createdAt: file.createdAt,
                updatedAt: file.updatedAt,
                status,
                totalSignees,
                signedCount,
                pendingCount,
                declinedCount,
                signatures: file.signatures?.map(sig => ({
                    id: sig.id,
                    userId: sig.userId,
                    user: sig.user ? {
                        id: sig.user.id,
                        name: sig.user.name,
                        ename: sig.user.ename,
                        avatarUrl: sig.user.avatarUrl,
                    } : null,
                    createdAt: sig.createdAt,
                })) || [],
            };
        });
    }

    async updateFile(
        id: string,
        userId: string,
        displayName?: string,
        description?: string
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

        return await this.fileRepository.save(file);
    }

    /**
     * Renames a file. Validates that the new name is not the reserved soft-delete sentinel.
     * @throws ReservedFileNameError if newName equals SOFT_DELETED_FILE_NAME
     */
    async renameFile(id: string, newName: string, userId: string): Promise<File | null> {
        this.validateFileName(newName);

        const file = await this.fileRepository.findOne({
            where: { id, ownerId: userId },
        });

        if (!file) {
            return null;
        }

        file.name = newName;
        if (file.displayName === null || file.displayName === file.name) {
            file.displayName = newName;
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

        await this.fileRepository.remove(file);
        return true;
    }

    async getFileSignatures(fileId: string): Promise<SignatureContainer[]> {
        return await this.signatureRepository.find({
            where: { fileId },
            relations: ["user", "fileSignee"],
            order: { createdAt: "ASC" },
        });
    }
}

