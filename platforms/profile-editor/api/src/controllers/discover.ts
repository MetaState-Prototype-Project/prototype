import type { Request, Response } from "express";
import type { AaasClient } from "../aaas";

function str(v: unknown): string {
    return typeof v === "string" ? v : "";
}

/**
 * Discovery across every eVault: pulls all User + Professional-Profile
 * envelopes from AaaS (the only stateless cross-user source), then filters to
 * public profiles and searches/pages in-memory. avatar is the public eVault
 * URL so the client renders it directly.
 */
export class DiscoverController {
    constructor(private aaas: AaasClient) {}

    discover = async (req: Request, res: Response) => {
        try {
            const q = str(req.query.q).trim().toLowerCase();
            const skills = str(req.query.skills)
                .split(",")
                .map((s) => s.trim().toLowerCase())
                .filter(Boolean);
            const page = Math.max(1, Number.parseInt(str(req.query.page)) || 1);
            const limit = Math.min(
                100,
                Math.max(1, Number.parseInt(str(req.query.limit)) || 12),
            );

            const profiles = await this.aaas.listAllProfiles();

            const matches = [...profiles.entries()]
                .map(([ename, { user, professional }]) => ({
                    ename,
                    user: user ?? {},
                    prof: professional ?? {},
                }))
                .filter(({ prof }) => prof.isPublic === true)
                .filter(({ ename, user, prof }) => {
                    if (q) {
                        const hay = [
                            user.displayName,
                            ename,
                            user.username,
                            prof.headline,
                            prof.bio,
                            prof.location,
                        ]
                            .map(str)
                            .join(" ")
                            .toLowerCase();
                        if (!hay.includes(q)) return false;
                    }
                    if (skills.length > 0) {
                        const have = ((prof.skills as string[]) ?? []).map((s) =>
                            s.toLowerCase(),
                        );
                        if (!skills.some((s) => have.includes(s))) return false;
                    }
                    return true;
                })
                .map(({ ename, user, prof }) => ({
                    ename,
                    name: (user.displayName ?? prof.displayName ?? null) as
                        | string
                        | null,
                    handle: (user.username ?? null) as string | null,
                    bio: (prof.bio ?? user.bio ?? null) as string | null,
                    avatar: (user.avatarUrl ?? null) as string | null,
                    headline: (prof.headline ?? null) as string | null,
                    location: (prof.location ?? null) as string | null,
                    skills: (prof.skills as string[]) ?? [],
                    isVerified: user.isVerified === true,
                }));

            // Verified first, then by name.
            matches.sort((a, b) => {
                if (a.isVerified !== b.isVerified) return a.isVerified ? -1 : 1;
                return str(a.name).localeCompare(str(b.name));
            });

            const total = matches.length;
            const start = (page - 1) * limit;
            const results = matches.slice(start, start + limit);

            res.setHeader("Cache-Control", "no-store");
            res.json({
                query: q,
                skills: skills.length ? skills : null,
                results,
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
            });
        } catch (error) {
            console.error("Discovery error:", (error as Error).message);
            res.status(500).json({ error: "Search service unavailable" });
        }
    };
}
