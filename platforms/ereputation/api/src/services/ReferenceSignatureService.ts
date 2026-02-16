import { AppDataSource } from "../database/data-source";
import { ReferenceSignature } from "../database/entities/ReferenceSignature";
import { Reference } from "../database/entities/Reference";
import { User } from "../database/entities/User";
import crypto from "crypto";

export class ReferenceSignatureService {
    private signatureRepository = AppDataSource.getRepository(ReferenceSignature);
    private referenceRepository = AppDataSource.getRepository(Reference);
    private userRepository = AppDataSource.getRepository(User);

    // Create a hash of the reference content to track versions
    createReferenceHash(referenceContent: string, targetType: string, targetId: string, numericScore?: number): string {
        const contentToHash = JSON.stringify({
            content: referenceContent,
            targetType,
            targetId,
            numericScore: numericScore || null
        });
        return crypto.createHash('sha256').update(contentToHash).digest('hex');
    }

    // Record a new signature
    async recordSignature(
        referenceId: string,
        userId: string,
        referenceContent: string,
        targetType: string,
        targetId: string,
        numericScore: number | undefined,
        signature: string,
        publicKey: string,
        message: string
    ): Promise<ReferenceSignature> {
        const referenceHash = this.createReferenceHash(referenceContent, targetType, targetId, numericScore);

        const referenceSignature = this.signatureRepository.create({
            referenceId,
            userId,
            referenceHash,
            signature,
            publicKey,
            message
        });

        const savedSignature = await this.signatureRepository.save(referenceSignature);

        // Update the reference status to "signed"
        const reference = await this.referenceRepository.findOne({
            where: { id: referenceId }
        });

        if (reference) {
            reference.status = "signed";
            await this.referenceRepository.save(reference);
        }

        return savedSignature;
    }

    // Get signature for a reference
    async getSignatureForReference(referenceId: string): Promise<ReferenceSignature | null> {
        return await this.signatureRepository.findOne({
            where: { referenceId },
            relations: ['user'],
            order: {
                createdAt: 'DESC'
            }
        });
    }

    // Check if a reference has been signed
    async hasReferenceBeenSigned(referenceId: string): Promise<boolean> {
        const signature = await this.getSignatureForReference(referenceId);
        return !!signature;
    }

    // Get all signatures for a user
    async getUserSignatures(userId: string): Promise<ReferenceSignature[]> {
        return await this.signatureRepository.find({
            where: { userId },
            relations: ['reference'],
            order: {
                createdAt: 'DESC'
            }
        });
    }
}

