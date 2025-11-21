import { Repository } from "typeorm";
import { AppDataSource } from "../database/data-source";
import { Reference } from "../database/entities/Reference";

export class ReferenceService {
    referenceRepository: Repository<Reference>;

    constructor() {
        this.referenceRepository = AppDataSource.getRepository(Reference);
    }

    async createReference(data: {
        targetType: string;
        targetId: string;
        targetName: string;
        content: string;
        referenceType: string;
        numericScore?: number;
        authorId: string;
    }): Promise<Reference> {
        // References start as "pending" and require a signature to become "signed"
        const reference = this.referenceRepository.create({
            ...data,
            status: "pending"
        });
        return await this.referenceRepository.save(reference);
    }

    async getReferencesForTarget(targetType: string, targetId: string, onlySigned: boolean = true): Promise<Reference[]> {
        const whereClause: any = { targetType, targetId };
        if (onlySigned) {
            whereClause.status = "signed";
        }
        
        return await this.referenceRepository.find({
            where: whereClause,
            relations: ["author"],
            order: { createdAt: "DESC" }
        });
    }

    async getUserReferences(authorId: string): Promise<Reference[]> {
        return await this.referenceRepository.find({
            where: { authorId },
            order: { createdAt: "DESC" }
        });
    }

    async revokeReference(referenceId: string, authorId: string): Promise<Reference | null> {
        const reference = await this.referenceRepository.findOne({
            where: { id: referenceId, authorId }
        });

        if (!reference) {
            return null;
        }

        reference.status = "revoked";
        return await this.referenceRepository.save(reference);
    }
}
