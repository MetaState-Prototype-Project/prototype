import { In, Repository } from "typeorm";
import { AppDataSource } from "../database/data-source";
import { ProfessionalProfile as ProfessionalProfileEntity } from "../database/entities/ProfessionalProfile";
import type { ProfessionalProfile } from "../types/profile";

function normalizeEname(w3id: string | undefined): string | null {
    if (!w3id || typeof w3id !== "string") return null;
    return w3id.startsWith("@") ? w3id.slice(1) : w3id;
}

export class ProfessionalProfileService {
    private repository: Repository<ProfessionalProfileEntity>;

    constructor() {
        this.repository = AppDataSource.getRepository(ProfessionalProfileEntity);
    }

    /**
     * Upsert professional profile from webhook payload.
     * Data should have universal/evault field names (displayName, headline, etc.)
     */
    async upsertFromWebhook(w3id: string | undefined, data: Record<string, unknown>): Promise<ProfessionalProfileEntity | null> {
        const ename = normalizeEname(w3id);
        if (!ename) return null;

        let existing = await this.repository.findOne({ where: { ename } });

        const payload: Partial<ProfessionalProfileEntity> = {
            displayName: (data.displayName ?? data.name) as string | undefined,
            headline: data.headline as string | undefined,
            bio: data.bio as string | undefined,
            avatarFileId: data.avatarFileId as string | undefined,
            bannerFileId: data.bannerFileId as string | undefined,
            cvFileId: data.cvFileId as string | undefined,
            videoIntroFileId: data.videoIntroFileId as string | undefined,
            location: data.location as string | undefined,
            skills: Array.isArray(data.skills) ? (data.skills as string[]) : undefined,
            workExperience: Array.isArray(data.workExperience) ? (data.workExperience as object[]) : undefined,
            education: Array.isArray(data.education) ? (data.education as object[]) : undefined,
            socialLinks: Array.isArray(data.socialLinks) ? (data.socialLinks as object[]) : undefined,
            isPublic: data.isPublic === true,
        };

        if (existing) {
            Object.assign(existing, payload);
            return this.repository.save(existing);
        }

        const created = this.repository.create({
            ename,
            ...payload,
        } as Partial<ProfessionalProfileEntity>);
        return this.repository.save(created);
    }

    /**
     * Load professional profiles for multiple enames. Returns a Map for quick lookup.
     */
    async getByEnames(enames: string[]): Promise<Map<string, ProfessionalProfile>> {
        const normalized = enames.map((e) => (e.startsWith("@") ? e.slice(1) : e));
        const unique = [...new Set(normalized)].filter(Boolean);
        if (unique.length === 0) return new Map();

        const rows = await this.repository.find({
            where: { ename: In(unique) },
        });

        const map = new Map<string, ProfessionalProfile>();
        for (const row of rows) {
            if (row.isPublic) {
                const profile = this.entityToProfile(row);
                map.set(row.ename, profile);
                map.set(`@${row.ename}`, profile); // support lookup with or without @ prefix
            }
        }
        return map;
    }

    private entityToProfile(entity: ProfessionalProfileEntity): ProfessionalProfile {
        const workExp = entity.workExperience as ProfessionalProfile["workExperience"];
        const edu = entity.education as ProfessionalProfile["education"];
        return {
            displayName: entity.displayName ?? undefined,
            headline: entity.headline ?? undefined,
            bio: entity.bio ?? undefined,
            avatarFileId: entity.avatarFileId ?? undefined,
            bannerFileId: entity.bannerFileId ?? undefined,
            cvFileId: entity.cvFileId ?? undefined,
            videoIntroFileId: entity.videoIntroFileId ?? undefined,
            location: entity.location ?? undefined,
            skills: entity.skills ?? undefined,
            workExperience: workExp ?? undefined,
            education: edu ?? undefined,
            isPublic: entity.isPublic,
        } as ProfessionalProfile;
    }
}
