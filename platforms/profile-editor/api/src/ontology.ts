import type {
    Education,
    FullProfile,
    SocialLink,
    WorkExperience,
} from "./types/profile";

export const USER_ONTOLOGY = "550e8400-e29b-41d4-a716-446655440000";
export const PROFESSIONAL_PROFILE_ONTOLOGY =
    "550e8400-e29b-41d4-a716-446655440009";

/** Raw eVault payloads (the MetaEnvelope `data` / packet `data`). */
export type Payload = Record<string, unknown>;

function str(v: unknown): string | undefined {
    return typeof v === "string" && v.length > 0 ? v : undefined;
}

/**
 * Assemble the client-facing profile from the two ontology payloads. Base
 * identity (name, avatar, banner) lives on the User ontology; everything else
 * on the Professional Profile. avatar/banner are public eVault-blob URLs.
 */
export function assembleProfile(
    ename: string,
    user: Payload | null,
    prof: Payload | null,
): FullProfile {
    const u = user ?? {};
    const p = prof ?? {};
    return {
        ename,
        name: str(u.displayName) ?? str(p.displayName) ?? ename,
        handle: str(u.username),
        isVerified: u.isVerified === true,
        professional: {
            displayName: str(p.displayName) ?? str(u.displayName),
            headline: str(p.headline),
            bio: str(p.bio) ?? str(u.bio),
            avatar: str(u.avatarUrl),
            banner: str(u.bannerUrl),
            cvFileId: str(p.cvFileId),
            videoIntroFileId: str(p.videoIntroFileId),
            email: str(p.email),
            phone: str(p.phone),
            website: str(p.website),
            location: str(p.location) ?? str(u.location),
            isPublic: p.isPublic === true,
            workExperience: (p.workExperience as WorkExperience[]) ?? [],
            education: (p.education as Education[]) ?? [],
            skills: (p.skills as string[]) ?? [],
            socialLinks: (p.socialLinks as SocialLink[]) ?? [],
        },
    };
}

/** Merge a client patch into the current User-ontology payload. */
export function mergeUserPayload(
    current: Payload,
    patch: Payload,
    ename: string,
): Payload {
    const next: Payload = { ...current, ename };
    if (patch.displayName !== undefined) next.displayName = patch.displayName;
    if (patch.bio !== undefined) next.bio = patch.bio;
    if (patch.location !== undefined) next.location = patch.location;
    if (patch.avatar !== undefined) next.avatarUrl = patch.avatar;
    if (patch.banner !== undefined) next.bannerUrl = patch.banner;
    return next;
}

/** Merge a client patch into the current Professional-Profile payload. */
export function mergeProfessionalPayload(
    current: Payload,
    patch: Payload,
): Payload {
    const next: Payload = { ...current };
    // Mirror the shared identity fields so platforms reading them here stay in sync.
    if (patch.displayName !== undefined) next.displayName = patch.displayName;
    if (patch.bio !== undefined) next.bio = patch.bio;
    if (patch.location !== undefined) next.location = patch.location;
    // Professional-only fields.
    if (patch.headline !== undefined) next.headline = patch.headline;
    if (patch.cvFileId !== undefined) next.cvFileId = patch.cvFileId;
    if (patch.videoIntroFileId !== undefined) {
        next.videoIntroFileId = patch.videoIntroFileId;
    }
    if (patch.email !== undefined) next.email = patch.email;
    if (patch.phone !== undefined) next.phone = patch.phone;
    if (patch.website !== undefined) next.website = patch.website;
    if (patch.isPublic !== undefined) next.isPublic = patch.isPublic;
    return next;
}
