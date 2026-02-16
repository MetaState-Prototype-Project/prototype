import { AppDataSource } from "../database/data-source";
import { FileAccess } from "../database/entities/FileAccess";
import { FolderAccess } from "../database/entities/FolderAccess";
import { File } from "../database/entities/File";
import { Folder } from "../database/entities/Folder";
import { User } from "../database/entities/User";
import { In } from "typeorm";
import { NotificationService } from "./NotificationService";

export class AccessService {
    private fileAccessRepository = AppDataSource.getRepository(FileAccess);
    private folderAccessRepository = AppDataSource.getRepository(FolderAccess);
    private fileRepository = AppDataSource.getRepository(File);
    private folderRepository = AppDataSource.getRepository(Folder);
    private userRepository = AppDataSource.getRepository(User);
    private notificationService: NotificationService;

    constructor() {
        this.notificationService = new NotificationService();
    }

    // File Access Management
    async grantFileAccess(
        fileId: string,
        userId: string,
        grantedBy: string,
        permission: "view" = "view"
    ): Promise<FileAccess> {
        // Verify file exists and granter is the owner
        const file = await this.fileRepository.findOne({
            where: { id: fileId, ownerId: grantedBy },
        });

        if (!file) {
            throw new Error("File not found or user is not the owner");
        }

        // Verify user exists
        const user = await this.userRepository.findOne({
            where: { id: userId },
        });

        if (!user) {
            throw new Error("User not found");
        }

        // Check if access already exists
        const existingAccess = await this.fileAccessRepository.findOne({
            where: { fileId, userId },
        });

        if (existingAccess) {
            return existingAccess;
        }

        // Create access record
        const access = this.fileAccessRepository.create({
            fileId,
            userId,
            grantedBy,
            permission,
        });

        const savedAccess = await this.fileAccessRepository.save(access);

        // Send notification (fire-and-forget)
        const granter = await this.userRepository.findOne({ where: { id: grantedBy } });
        const granterName = granter?.name || granter?.ename;
        this.notificationService.sendFileSharedNotification(userId, file, granterName).catch(error => {
            console.error(`Failed to send file shared notification:`, error);
        });

        return savedAccess;
    }

    async revokeFileAccess(fileId: string, userId: string, revokedBy: string): Promise<boolean> {
        // Verify file exists and revoker is the owner
        const file = await this.fileRepository.findOne({
            where: { id: fileId, ownerId: revokedBy },
        });

        if (!file) {
            throw new Error("File not found or user is not the owner");
        }

        const result = await this.fileAccessRepository.delete({ fileId, userId });
        return (result.affected || 0) > 0;
    }

    async getFileAccess(fileId: string, userId: string): Promise<FileAccess[]> {
        // Verify user has access to the file (owner or has access)
        const file = await this.fileRepository.findOne({
            where: { id: fileId },
        });

        if (!file) {
            throw new Error("File not found");
        }

        if (file.ownerId !== userId) {
            const access = await this.fileAccessRepository.findOne({
                where: { fileId, userId },
            });
            if (!access) {
                throw new Error("Access denied");
            }
        }

        return await this.fileAccessRepository.find({
            where: { fileId },
            relations: ["user", "granter"],
        });
    }

    // Folder Access Management
    async grantFolderAccess(
        folderId: string,
        userId: string,
        grantedBy: string,
        permission: "view" = "view"
    ): Promise<FolderAccess> {
        // Verify folder exists and granter is the owner
        const folder = await this.folderRepository.findOne({
            where: { id: folderId, ownerId: grantedBy },
        });

        if (!folder) {
            throw new Error("Folder not found or user is not the owner");
        }

        // Verify user exists
        const user = await this.userRepository.findOne({
            where: { id: userId },
        });

        if (!user) {
            throw new Error("User not found");
        }

        // Check if access already exists
        const existingAccess = await this.folderAccessRepository.findOne({
            where: { folderId, userId },
        });

        if (existingAccess) {
            return existingAccess;
        }

        // Create access record
        const access = this.folderAccessRepository.create({
            folderId,
            userId,
            grantedBy,
            permission,
        });

        const savedAccess = await this.folderAccessRepository.save(access);

        // Send notification (fire-and-forget)
        const granter = await this.userRepository.findOne({ where: { id: grantedBy } });
        const granterName = granter?.name || granter?.ename;
        this.notificationService.sendFolderSharedNotification(userId, folder, granterName).catch(error => {
            console.error(`Failed to send folder shared notification:`, error);
        });

        return savedAccess;
    }

    async revokeFolderAccess(folderId: string, userId: string, revokedBy: string): Promise<boolean> {
        // Verify folder exists and revoker is the owner
        const folder = await this.folderRepository.findOne({
            where: { id: folderId, ownerId: revokedBy },
        });

        if (!folder) {
            throw new Error("Folder not found or user is not the owner");
        }

        const result = await this.folderAccessRepository.delete({ folderId, userId });
        return (result.affected || 0) > 0;
    }

    async getFolderAccess(folderId: string, userId: string): Promise<FolderAccess[]> {
        // Verify user has access to the folder (owner or has access)
        const folder = await this.folderRepository.findOne({
            where: { id: folderId },
        });

        if (!folder) {
            throw new Error("Folder not found");
        }

        if (folder.ownerId !== userId) {
            const access = await this.folderAccessRepository.findOne({
                where: { folderId, userId },
            });
            if (!access) {
                throw new Error("Access denied");
            }
        }

        return await this.folderAccessRepository.find({
            where: { folderId },
            relations: ["user", "granter"],
        });
    }

    async checkFileAccess(fileId: string, userId: string): Promise<boolean> {
        const file = await this.fileRepository.findOne({
            where: { id: fileId },
        });

        if (!file) {
            return false;
        }

        if (file.ownerId === userId) {
            return true;
        }

        const access = await this.fileAccessRepository.findOne({
            where: { fileId, userId },
        });

        return !!access;
    }

    async checkFolderAccess(folderId: string, userId: string): Promise<boolean> {
        const folder = await this.folderRepository.findOne({
            where: { id: folderId },
        });

        if (!folder) {
            return false;
        }

        if (folder.ownerId === userId) {
            return true;
        }

        const access = await this.folderAccessRepository.findOne({
            where: { folderId, userId },
        });

        return !!access;
    }
}

