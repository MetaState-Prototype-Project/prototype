import type { Request, Response } from "express";
import type { AaasClient } from "../aaas";
import type { EvaultWriter } from "../evault";
import {
    assembleProfile,
    mergeProfessionalPayload,
    mergeUserPayload,
    type Payload,
    PROFESSIONAL_PROFILE_ONTOLOGY,
    USER_ONTOLOGY,
} from "../ontology";

/**
 * W3DS-native profile CRUD: reads are pulled from AaaS, writes go straight to
 * the owner's eVault. No local state.
 */
export class ProfileController {
    constructor(
        private aaas: AaasClient,
        private evault: EvaultWriter,
    ) {}

    private async build(ename: string) {
        const { user, professional } =
            await this.aaas.getProfileEnvelopes(ename);
        return assembleProfile(
            ename,
            user?.data ?? null,
            professional?.data ?? null,
        );
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
            const patch = req.body as Payload;
            const { user, professional } =
                await this.aaas.getProfileEnvelopes(ename);

            const userPayload = mergeUserPayload(
                user?.data ?? {},
                patch,
                ename,
            );
            const profPayload = mergeProfessionalPayload(
                professional?.data ?? {},
                patch,
            );

            await this.evault.upsertEnvelope(
                ename,
                USER_ONTOLOGY,
                user?.id ?? null,
                userPayload,
            );
            await this.evault.upsertEnvelope(
                ename,
                PROFESSIONAL_PROFILE_ONTOLOGY,
                professional?.id ?? null,
                profPayload,
            );

            res.json(assembleProfile(ename, userPayload, profPayload));
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
                const { user, professional } =
                    await this.aaas.getProfileEnvelopes(ename);
                const profPayload: Payload = {
                    ...(professional?.data ?? {}),
                    [field]: req.body,
                };
                await this.evault.upsertEnvelope(
                    ename,
                    PROFESSIONAL_PROFILE_ONTOLOGY,
                    professional?.id ?? null,
                    profPayload,
                );
                res.json(
                    assembleProfile(ename, user?.data ?? null, profPayload),
                );
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
            // Base identity (name, avatar, banner) is always public; the
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
