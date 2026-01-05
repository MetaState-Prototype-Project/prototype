import { AppDataSource } from "../database/data-source";
import { Folder } from "../database/entities/Folder";
import { File } from "../database/entities/File";
import { FolderAccess } from "../database/entities/FolderAccess";
import { In, IsNull } from "typeorm";

export class FolderService {
    private folderRepository = AppDataSource.getRepository(Folder);
    private folderAccessRepository = AppDataSource.getRepository(FolderAccess);
    private fileRepository = AppDataSource.getRepository(File);

    async createFolder(
        name: string,
        ownerId: string,
        parentFolderId?: string | null
    ): Promise<Folder> {
        // Verify parent folder exists and user owns it if parentFolderId is provided
        if (parentFolderId) {
            const parentFolder = await this.folderRepository.findOne({
                where: { id: parentFolderId, ownerId },
            });
            if (!parentFolder) {
                throw new Error("Parent folder not found or user is not the owner");
            }
        }

        // Prevent circular references
        if (parentFolderId) {
            const isCircular = await this.checkCircularReference(parentFolderId, ownerId);
            if (isCircular) {
                throw new Error("Cannot create folder: would create circular reference");
            }
        }

        const folder = this.folderRepository.create({
            name,
            ownerId,
            parentFolderId: parentFolderId || null,
        });

        return await this.folderRepository.save(folder);
    }

    async getFolderById(id: string, userId: string): Promise<Folder | null> {
        const folder = await this.folderRepository.findOne({
            where: { id },
            relations: ["owner", "parent", "children", "files", "tags"],
        });

        if (!folder) {
            return null;
        }

        // Check access: owner or has access permission
        if (folder.ownerId === userId) {
            return folder;
        }
        
        // Check for direct access
        const access = await this.folderAccessRepository.findOne({
            where: { folderId: id, userId },
        });
        
        if (access) {
            return folder;
        }

        // Check if user has access via a parent folder (recursive check)
        // This allows breadcrumbs to work for nested shared folders
        const hasAccessViaParent = await this.hasAccessViaParentFolder(id, userId);
        if (hasAccessViaParent) {
            return folder;
        }

        return null;
    }

    async getUserFolders(userId: string, parentFolderId?: string | null): Promise<Folder[]> {
        // Get folders owned by user
        // Explicitly check for null or undefined to get root-level folders
        let ownedFolders: Folder[];
        
        if (parentFolderId === null || parentFolderId === undefined || parentFolderId === 'null' || parentFolderId === '') {
            // Root level folders (no parent) - parentFolderId must be null
            // Use IsNull() for proper NULL checking in TypeORM
            ownedFolders = await this.folderRepository.find({
                where: {
                    ownerId: userId,
                    parentFolderId: IsNull()
                },
                relations: ["owner", "parent", "tags"],
                order: { createdAt: "DESC" },
            });
        } else {
            // Folders in specific parent folder
            ownedFolders = await this.folderRepository.find({
                where: {
                    ownerId: userId,
                    parentFolderId: parentFolderId
                },
                relations: ["owner", "parent", "tags"],
                order: { createdAt: "DESC" },
            });
        }

        // Get folders where user has access
        const accessedFolders = await this.folderAccessRepository.find({
            where: { userId },
            relations: ["folder", "folder.owner", "folder.parent", "folder.tags"],
        });

        // Get subfolders from folders the user has access to (only direct children to preserve hierarchy)
        let folderAccessSubfolders: Folder[] = [];
        if (parentFolderId && parentFolderId !== 'null' && parentFolderId !== '') {
            const parentFolderAccess = await this.folderAccessRepository.findOne({
                where: { folderId: parentFolderId, userId },
            });
            
            // Also check if user has access via a parent folder
            let hasAccessViaParent = false;
            if (!parentFolderAccess) {
                hasAccessViaParent = await this.hasAccessViaParentFolder(parentFolderId, userId);
            }
            
            if (parentFolderAccess || hasAccessViaParent) {
                // User has access to this parent folder (directly or via parent), show only direct subfolders
                // This preserves the folder hierarchy - nested subfolders will show when viewing their parent
                folderAccessSubfolders = await this.folderRepository.find({
                    where: { parentFolderId },
                    relations: ["owner", "parent", "tags"],
                    order: { createdAt: "DESC" },
                });
            }
        }

        const ownedFolderIds = new Set(ownedFolders.map(f => f.id));
        const allFolders = [...ownedFolders];

        // Add accessed folders that aren't already in the list and match parent folder filter
        for (const folderAccess of accessedFolders) {
            if (!folderAccess.folder) continue;
            
            // Skip if already in owned folders
            if (ownedFolderIds.has(folderAccess.folderId)) continue;
            
            // Filter by parent folder if specified
            if (parentFolderId === null || parentFolderId === undefined || parentFolderId === 'null' || parentFolderId === '') {
                // When viewing root, show ALL shared folders regardless of their parent folder location
                // This allows users to see all shared folders in the "Shared with me" view
                allFolders.push(folderAccess.folder);
            } else {
                // Only add folders in the specified parent folder
                if (folderAccess.folder.parentFolderId === parentFolderId) {
                    allFolders.push(folderAccess.folder);
                }
            }
        }

        // Add subfolders from folders the user has access to
        for (const folder of folderAccessSubfolders) {
            if (!ownedFolderIds.has(folder.id) && !allFolders.find(f => f.id === folder.id)) {
                allFolders.push(folder);
            }
        }

        return allFolders;
    }

    async getFolderContents(folderId: string, userId: string): Promise<{ files: File[]; folders: Folder[] }> {
        const folder = await this.getFolderById(folderId, userId);
        if (!folder) {
            throw new Error("Folder not found or access denied");
        }

        const files = await AppDataSource.getRepository(File).find({
            where: { folderId },
            relations: ["owner", "tags"],
            order: { createdAt: "DESC" },
        });

        const folders = await this.folderRepository.find({
            where: { parentFolderId: folderId },
            relations: ["owner", "tags"],
            order: { createdAt: "DESC" },
        });

        return { files, folders };
    }

    async updateFolder(
        id: string,
        userId: string,
        name?: string,
        parentFolderId?: string | null
    ): Promise<Folder | null> {
        const folder = await this.folderRepository.findOne({
            where: { id, ownerId: userId },
        });

        if (!folder) {
            return null;
        }

        if (name !== undefined) {
            folder.name = name;
        }
        if (parentFolderId !== undefined) {
            // Prevent circular references
            if (parentFolderId && parentFolderId === id) {
                throw new Error("Cannot move folder into itself");
            }
            if (parentFolderId) {
                const isCircular = await this.checkCircularReference(parentFolderId, userId, id);
                if (isCircular) {
                    throw new Error("Cannot move folder: would create circular reference");
                }
                const parentFolder = await this.folderRepository.findOne({
                    where: { id: parentFolderId, ownerId: userId },
                });
                if (!parentFolder) {
                    throw new Error("Parent folder not found or user is not the owner");
                }
            }
            folder.parentFolderId = parentFolderId;
        }

        return await this.folderRepository.save(folder);
    }

    async deleteFolder(id: string, userId: string): Promise<boolean> {
        const folder = await this.folderRepository.findOne({
            where: { id, ownerId: userId },
        });

        if (!folder) {
            return false;
        }

        // Recursively delete all child folders and files
        await this.deleteFolderRecursive(id);

        // Delete all access records
        await this.folderAccessRepository.delete({ folderId: id });

        await this.folderRepository.remove(folder);
        return true;
    }

    private async deleteFolderRecursive(folderId: string): Promise<void> {
        // Get all child folders
        const childFolders = await this.folderRepository.find({
            where: { parentFolderId: folderId },
        });

        // Recursively delete child folders
        for (const childFolder of childFolders) {
            await this.deleteFolderRecursive(childFolder.id);
            await this.folderAccessRepository.delete({ folderId: childFolder.id });
            await this.folderRepository.remove(childFolder);
        }

        // Delete all files in this folder
        const files = await this.fileRepository.find({
            where: { folderId },
        });

        for (const file of files) {
            await AppDataSource.getRepository(File).remove(file);
        }
    }

    async moveFolder(folderId: string, parentFolderId: string | null, userId: string): Promise<Folder | null> {
        return await this.updateFolder(folderId, userId, undefined, parentFolderId);
    }

    private async checkCircularReference(folderId: string, ownerId: string, excludeFolderId?: string): Promise<boolean> {
        // Check if moving to this folder would create a circular reference
        let currentFolderId: string | null = folderId;
        const visited = new Set<string>();

        while (currentFolderId) {
            if (visited.has(currentFolderId)) {
                return true; // Circular reference detected
            }
            if (excludeFolderId && currentFolderId === excludeFolderId) {
                return true; // Would create a cycle
            }
            visited.add(currentFolderId);

            const folder = await this.folderRepository.findOne({
                where: { id: currentFolderId, ownerId },
            });

            if (!folder) {
                break;
            }

            currentFolderId = folder.parentFolderId;
        }

        return false;
    }

    async getFolderTree(userId: string): Promise<Folder[]> {
        // Get all folders owned by user or accessible to user
        const ownedFolders = await this.folderRepository.find({
            where: { ownerId: userId },
            relations: ["parent", "children"],
        });

        const accessedFolders = await this.folderAccessRepository.find({
            where: { userId },
            relations: ["folder", "folder.parent", "folder.children"],
        });

        const allFolders = [...ownedFolders];
        for (const access of accessedFolders) {
            if (access.folder && !allFolders.find(f => f.id === access.folder.id)) {
                allFolders.push(access.folder);
            }
        }

        return allFolders;
    }

    /**
     * Check if user has access to a folder via any parent folder (recursive check)
     * Walks all the way up to root, checking if ANY folder in the path was shared
     */
    private async hasAccessViaParentFolder(folderId: string, userId: string, visited: Set<string> = new Set()): Promise<boolean> {
        // Prevent infinite loops
        if (visited.has(folderId)) {
            return false;
        }
        visited.add(folderId);

        // Walk up the folder tree all the way to root, checking each level
        let currentFolderId: string | null = folderId;
        
        while (currentFolderId) {
            const folder = await this.folderRepository.findOne({
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
            const access = await this.folderAccessRepository.findOne({
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
}

