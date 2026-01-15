import { AppDataSource } from "../database/data-source";
import { File } from "../database/entities/File";
import { FileSignee } from "../database/entities/FileSignee";
import { SignatureContainer } from "../database/entities/SignatureContainer";
import { User } from "../database/entities/User";
import { In } from "typeorm";
import { NotificationService } from "./NotificationService";

export class InvitationService {
    private fileRepository = AppDataSource.getRepository(File);
    private fileSigneeRepository = AppDataSource.getRepository(FileSignee);
    private signatureRepository = AppDataSource.getRepository(SignatureContainer);
    private userRepository = AppDataSource.getRepository(User);
    private notificationService = new NotificationService();

    async inviteSignees(
        fileId: string,
        userIds: string[],
        invitedBy: string
    ): Promise<FileSignee[]> {
        // Verify file exists and user is owner
        const file = await this.fileRepository.findOne({
            where: { id: fileId, ownerId: invitedBy },
        });

        if (!file) {
            throw new Error("File not found or user is not the owner");
        }

        // Check if file already has signatures (single-use enforcement)
        const existingSignatures = await this.signatureRepository.find({
            where: { fileId },
        });

        if (existingSignatures.length > 0) {
            throw new Error("This file has already been used in a signature container and cannot be reused");
        }

        // Filter out the owner from userIds (they can't invite themselves)
        const filteredUserIds = userIds.filter(userId => userId !== invitedBy);
        
        // Verify all users exist (only if there are users to invite)
        if (filteredUserIds.length > 0) {
            const users = await this.userRepository.find({
                where: { id: In(filteredUserIds) }
            });
            if (users.length !== filteredUserIds.length) {
                throw new Error("One or more users not found");
            }
        }

        // Create invitations
        const invitations: FileSignee[] = [];
        
        // Always automatically add owner as a signee (for self-signed documents)
        const ownerExisting = await this.fileSigneeRepository.findOne({
            where: { fileId, userId: invitedBy },
        });
        
        if (!ownerExisting) {
            const ownerInvitation = this.fileSigneeRepository.create({
                fileId,
                userId: invitedBy,
                invitedBy,
                status: "pending",
            });
            invitations.push(await this.fileSigneeRepository.save(ownerInvitation));
        }
        
        // Get inviter user for notification
        const inviter = await this.userRepository.findOne({ where: { id: invitedBy } });
        const inviterName = inviter?.name || inviter?.ename;

        // Then add invited users (excluding owner)
        for (const userId of filteredUserIds) {
            // Check if invitation already exists
            const existing = await this.fileSigneeRepository.findOne({
                where: { fileId, userId },
            });

            if (!existing) {
                const invitation = this.fileSigneeRepository.create({
                    fileId,
                    userId,
                    invitedBy,
                    status: "pending",
                });
                const savedInvitation = await this.fileSigneeRepository.save(invitation);
                invitations.push(savedInvitation);

                // Send notification to invited user (fire-and-forget)
                this.notificationService.sendInvitationNotification(userId, file, inviterName).catch(error => {
                    console.error(`Failed to send invitation notification to user ${userId}:`, error);
                });
            }
        }

        return invitations;
    }

    async getFileInvitations(fileId: string, userId: string): Promise<FileSignee[]> {
        // Verify file exists
        const file = await this.fileRepository.findOne({
            where: { id: fileId },
        });

        if (!file) {
            throw new Error("File not found");
        }

        // Check if user is owner or invited signee
        const isOwner = file.ownerId === userId;
        const isInvited = await this.fileSigneeRepository.findOne({
            where: { fileId, userId },
        });

        if (!isOwner && !isInvited) {
            throw new Error("File not found or user is not authorized");
        }

        return await this.fileSigneeRepository.find({
            where: { fileId },
            relations: ["user", "signature"],
            order: { invitedAt: "DESC" },
        });
    }

    async getUserInvitations(userId: string): Promise<FileSignee[]> {
        return await this.fileSigneeRepository.find({
            where: { userId, status: "pending" },
            relations: ["file", "file.owner"],
            order: { invitedAt: "DESC" },
        });
    }

    async declineInvitation(invitationId: string, userId: string): Promise<boolean> {
        const invitation = await this.fileSigneeRepository.findOne({
            where: { id: invitationId, userId },
        });

        if (!invitation) {
            return false;
        }

        if (invitation.status !== "pending") {
            throw new Error("Invitation is not pending");
        }

        invitation.status = "declined";
        invitation.declinedAt = new Date();
        await this.fileSigneeRepository.save(invitation);
        return true;
    }

    async getPendingInvitation(fileId: string, userId: string): Promise<FileSignee | null> {
        return await this.fileSigneeRepository.findOne({
            where: { fileId, userId, status: "pending" },
        });
    }

    async updateInvitationStatus(
        fileId: string,
        userId: string,
        status: "signed" | "declined"
    ): Promise<void> {
        const invitation = await this.fileSigneeRepository.findOne({
            where: { fileId, userId },
        });

        if (!invitation) {
            throw new Error("Invitation not found");
        }

        invitation.status = status;
        if (status === "signed") {
            invitation.signedAt = new Date();
        } else {
            invitation.declinedAt = new Date();
        }

        await this.fileSigneeRepository.save(invitation);
    }
}

