import { AppDataSource } from "../database/data-source";
import { CharterSignature } from "../database/entities/CharterSignature";
import { Group } from "../database/entities/Group";
import { User } from "../database/entities/User";
import crypto from "crypto";

export class CharterSignatureService {
    private signatureRepository = AppDataSource.getRepository(CharterSignature);
    private groupRepository = AppDataSource.getRepository(Group);
    private userRepository = AppDataSource.getRepository(User);

    // Create a hash of the charter content to track versions
    createCharterHash(charterContent: string): string {
        return crypto.createHash('sha256').update(charterContent).digest('hex');
    }

    // Record a new signature
    async recordSignature(
        groupId: string,
        userId: string,
        charterContent: string,
        signature: string,
        publicKey: string,
        message: string
    ): Promise<CharterSignature> {
        const charterHash = this.createCharterHash(charterContent);
        
        const charterSignature = this.signatureRepository.create({
            groupId,
            userId,
            charterHash,
            signature,
            publicKey,
            message
        });

        return await this.signatureRepository.save(charterSignature);
    }

    // Get all signatures for a specific charter version
    async getSignaturesForCharter(groupId: string, charterContent: string): Promise<CharterSignature[]> {
        const charterHash = this.createCharterHash(charterContent);
        
        return await this.signatureRepository.find({
            where: {
                groupId,
                charterHash
            },
            relations: ['user'],
            order: {
                createdAt: 'ASC'
            }
        });
    }

    // Get all signatures for a group (latest version)
    async getLatestSignaturesForGroup(groupId: string): Promise<CharterSignature[]> {
        const group = await this.groupRepository.findOne({
            where: { id: groupId },
            select: ['charter']
        });

        if (!group?.charter) {
            return [];
        }

        return await this.getSignaturesForCharter(groupId, group.charter);
    }

    // Check if a user has signed the current charter version
    async hasUserSignedCharter(groupId: string, userId: string, charterContent: string): Promise<boolean> {
        const charterHash = this.createCharterHash(charterContent);
        
        const signature = await this.signatureRepository.findOne({
            where: {
                groupId,
                userId,
                charterHash
            }
        });

        return !!signature;
    }

    // Get signing status for all participants in a group
    async getGroupSigningStatus(groupId: string): Promise<{
        participants: any[];
        signatures: CharterSignature[];
        charterHash: string;
        isSigned: boolean;
    }> {
        const group = await this.groupRepository.findOne({
            where: { id: groupId },
            relations: ['participants']
        });

        if (!group) {
            throw new Error("Group not found");
        }

        const charterHash = group.charter ? this.createCharterHash(group.charter) : "";
        const signatures = charterHash ? await this.getSignaturesForCharter(groupId, group.charter) : [];

        // Create a map of signed user IDs for quick lookup
        const signedUserIds = new Set(signatures.map(s => s.userId));

        // Add signing status and role information to each participant
        const participantsWithStatus = group.participants.map(participant => ({
            ...participant,
            hasSigned: signedUserIds.has(participant.id),
            isAdmin: group.admins?.includes(participant.id) || false,
            isOwner: group.owner === participant.id
        }));

        return {
            participants: participantsWithStatus,
            signatures,
            charterHash,
            isSigned: signatures.length > 0
        };
    }

    // Get all signatures for a user across all groups
    async getUserSignatures(userId: string): Promise<CharterSignature[]> {
        return await this.signatureRepository.find({
            where: { userId },
            relations: ['group'],
            order: {
                createdAt: 'DESC'
            }
        });
    }

    // Delete all signatures for a group (when charter content changes)
    async deleteAllSignaturesForGroup(groupId: string): Promise<void> {
        const result = await this.signatureRepository.delete({
            groupId
        });
        
        console.log(`Deleted ${result.affected || 0} signatures for group ${groupId} due to charter content change`);
    }
} 