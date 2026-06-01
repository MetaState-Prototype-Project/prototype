import type { Request, Response } from "express";
import type { ProfessionalProfile } from "../entities/ProfessionalProfile";
import type { User } from "../entities/User";
import type { ProfessionalProfileService } from "../services/ProfessionalProfileService";
import type { UserService } from "../services/UserService";
import type { FullProfile } from "../types/profile";

/** Assemble the client-facing profile from the two local tables. */
function buildFullProfile(
    ename: string,
    user: User | null,
    prof: ProfessionalProfile | null,
): FullProfile {
    return {
        ename,
        name: user?.name ?? prof?.name ?? ename,
        handle: user?.handle ?? undefined,
        isVerified: user?.isVerified ?? false,
        professional: {
            displayName: prof?.name ?? user?.name ?? undefined,
            headline: prof?.headline ?? undefined,
            bio: prof?.bio ?? user?.bio ?? undefined,
            avatar: user?.avatarUrl ?? undefined, // base identity: a public URL
            banner: user?.bannerUrl ?? undefined,
            cvFileId: prof?.cvFileId ?? undefined,
            videoIntroFileId: prof?.videoIntroFileId ?? undefined,
            email: prof?.email ?? undefined,
            phone: prof?.phone ?? undefined,
            website: prof?.website ?? undefined,
            location: prof?.location ?? user?.location ?? undefined,
            isPublic: prof?.isPublic === true,
            workExperience: prof?.workExperience ?? [],
            education: prof?.education ?? [],
            skills: prof?.skills ?? [],
            socialLinks: prof?.socialLinks ?? [],
        },
    };
}

export class ProfileController {
    constructor(
        private users: UserService,
        private profiles: ProfessionalProfileService,
    ) {}

    private async build(ename: string): Promise<FullProfile> {
        const [user, prof] = await Promise.all([
            this.users.findByEname(ename),
            this.profiles.findByEname(ename),
        ]);
        return buildFullProfile(ename, user, prof);
    }

    getProfile = async (req: Request, res: Response) => {
        try {
            const ename = req.user?.ename;
            if (!ename) {
                return res
                    .status(401)
                    .json({ error: "Authentication required" });
            }
            res.json(await this.build(ename));
        } catch (error) {
            console.error("Error fetching profile:", (error as Error).message);
            res.status(500).json({ error: "Failed to fetch profile" });
        }
    };

    updateProfile = async (req: Request, res: Response) => {
        try {
            const ename = req.user?.ename;
            if (!ename) {
                return res
                    .status(401)
                    .json({ error: "Authentication required" });
            }
            const p = req.body;
            const user = await this.users.getOrNew(ename);
            const prof = await this.profiles.getOrNew(ename);

            // Base identity (shared with all platforms via the User ontology) —
            // mirror name/bio/location onto the professional profile too so
            // dreamsync (which reads them there) stays in sync.
            if (p.displayName !== undefined) {
                user.name = p.displayName;
                prof.name = p.displayName;
            }
            if (p.bio !== undefined) {
                user.bio = p.bio;
                prof.bio = p.bio;
            }
            if (p.location !== undefined) {
                user.location = p.location;
                prof.location = p.location;
            }
            if (p.avatar !== undefined) user.avatarUrl = p.avatar;
            if (p.banner !== undefined) user.bannerUrl = p.banner;

            // Professional-only fields.
            if (p.headline !== undefined) prof.headline = p.headline;
            if (p.cvFileId !== undefined) prof.cvFileId = p.cvFileId;
            if (p.videoIntroFileId !== undefined) {
                prof.videoIntroFileId = p.videoIntroFileId;
            }
            if (p.email !== undefined) prof.email = p.email;
            if (p.phone !== undefined) prof.phone = p.phone;
            if (p.website !== undefined) prof.website = p.website;
            if (p.isPublic !== undefined) prof.isPublic = p.isPublic;

            await this.users.save(user);
            await this.profiles.save(prof);
            res.json(await this.build(ename));
        } catch (error) {
            console.error("[profile] update failed:", (error as Error).message);
            res.status(500).json({ error: "Failed to update profile" });
        }
    };

    private updateProfArray(
        field: "workExperience" | "education" | "skills" | "socialLinks",
        label: string,
    ) {
        return async (req: Request, res: Response) => {
            try {
                const ename = req.user?.ename;
                if (!ename) {
                    return res
                        .status(401)
                        .json({ error: "Authentication required" });
                }
                const prof = await this.profiles.getOrNew(ename);
                (prof as unknown as Record<string, unknown>)[field] = req.body;
                await this.profiles.save(prof);
                res.json(await this.build(ename));
            } catch (error) {
                console.error(
                    `[profile] ${label} failed:`,
                    (error as Error).message,
                );
                res.status(500).json({ error: `Failed to update ${label}` });
            }
        };
    }

    updateWorkExperience = this.updateProfArray(
        "workExperience",
        "work experience",
    );
    updateEducation = this.updateProfArray("education", "education");
    updateSkills = this.updateProfArray("skills", "skills");
    updateSocialLinks = this.updateProfArray("socialLinks", "social links");

    getPublicProfile = async (req: Request, res: Response) => {
        try {
            const profile = await this.build(req.params.ename);
            // Base identity (name, avatar, banner) is always returned; the
            // professional details are gated behind isPublic.
            if (!profile.professional.isPublic) {
                return res.json({
                    ename: profile.ename,
                    name: profile.name,
                    handle: profile.handle,
                    isVerified: profile.isVerified,
                    professional: {
                        displayName: profile.professional.displayName,
                        avatar: profile.professional.avatar,
                        banner: profile.professional.banner,
                        isPublic: false,
                        workExperience: [],
                        education: [],
                        skills: [],
                        socialLinks: [],
                    },
                });
            }
            res.json(profile);
        } catch (error) {
            console.error(
                "Error fetching public profile:",
                (error as Error).message,
            );
            res.status(500).json({ error: "Failed to fetch profile" });
        }
    };
}
