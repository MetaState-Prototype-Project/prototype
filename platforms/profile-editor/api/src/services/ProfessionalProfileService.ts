import type { Repository } from "typeorm";
import { AppDataSource } from "../db";
import { ProfessionalProfile } from "../entities/ProfessionalProfile";

/** Local fields the adapter maps from the Professional Profile ontology. */
const PROFILE_FIELDS = [
    "name",
    "headline",
    "bio",
    "location",
    "skills",
    "cvFileId",
    "videoIntroFileId",
    "isPublic",
    "workExperience",
    "education",
    "socialLinks",
    "email",
    "phone",
    "website",
] as const;

export class ProfessionalProfileService {
    private repo: Repository<ProfessionalProfile>;

    constructor() {
        this.repo = AppDataSource.getRepository(ProfessionalProfile);
    }

    findByEname(ename: string): Promise<ProfessionalProfile | null> {
        return this.repo.findOneBy({ ename });
    }

    /** Existing row, or a new unsaved one — caller mutates then saves once. */
    async getOrNew(ename: string): Promise<ProfessionalProfile> {
        return (
            (await this.repo.findOneBy({ ename })) ??
            this.repo.create({ ename })
        );
    }

    save(profile: ProfessionalProfile): Promise<ProfessionalProfile> {
        return this.repo.save(profile);
    }

    /** Upsert from an inbound webhook (adapter fromGlobal output). */
    async upsertFromGlobal(
        ename: string,
        data: Record<string, unknown>,
    ): Promise<ProfessionalProfile> {
        const profile =
            (await this.repo.findOneBy({ ename })) ??
            this.repo.create({ ename });
        const target = profile as unknown as Record<string, unknown>;
        for (const key of PROFILE_FIELDS) {
            if (data[key] !== undefined) target[key] = data[key];
        }
        return this.repo.save(profile);
    }
}
