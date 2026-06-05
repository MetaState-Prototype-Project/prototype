import type { Request, Response } from "express";
import { AppDataSource } from "../db";
import { ProfessionalProfile } from "../entities/ProfessionalProfile";
import { User } from "../entities/User";

interface RawRow {
    id: string;
    ename: string;
    name: string | null;
    handle: string | null;
    bio: string | null;
    avatar: string | null;
    headline: string | null;
    location: string | null;
    skills: string[] | null;
    isverified: boolean;
}

/**
 * Discovery over the local source-of-truth tables: public professional
 * profiles joined to their base identity. avatar is the public URL so the
 * client renders it directly.
 */
export class DiscoverController {
    discover = async (req: Request, res: Response) => {
        try {
            const q = ((req.query.q as string) ?? "").trim();
            const skills = ((req.query.skills as string) ?? "")
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean);
            const skillsFilter = skills.length > 0 ? skills : null;
            const page = Math.max(
                1,
                Number.parseInt(req.query.page as string) || 1,
            );
            const limit = Math.min(
                100,
                Math.max(1, Number.parseInt(req.query.limit as string) || 12),
            );

            const base = AppDataSource.getRepository(ProfessionalProfile)
                .createQueryBuilder("p")
                .innerJoin(User, "u", "u.ename = p.ename")
                .where("p.isPublic = :pub", { pub: true })
                .andWhere("COALESCE(u.isArchived, false) = false");

            if (q) {
                base.andWhere(
                    `(COALESCE(u.name,'') ILIKE :q OR u.ename ILIKE :q OR COALESCE(u.handle,'') ILIKE :q
					OR COALESCE(p.headline,'') ILIKE :q OR COALESCE(p.bio,'') ILIKE :q OR COALESCE(p.location,'') ILIKE :q)`,
                    { q: `%${q}%` },
                );
            }
            if (skillsFilter) {
                base.andWhere("p.skills && :skills", { skills: skillsFilter });
            }

            const total = await base.getCount();

            const rows = (await base
                .clone()
                .select([
                    "p.id AS id",
                    "u.ename AS ename",
                    "u.name AS name",
                    "u.handle AS handle",
                    "p.bio AS bio",
                    "u.avatarUrl AS avatar",
                    "p.headline AS headline",
                    "p.location AS location",
                    "p.skills AS skills",
                    "u.isVerified AS isverified",
                ])
                .orderBy("u.isVerified", "DESC")
                .addOrderBy("u.name", "ASC")
                .offset((page - 1) * limit)
                .limit(limit)
                .getRawMany()) as RawRow[];

            res.setHeader(
                "Cache-Control",
                "no-store, no-cache, must-revalidate, proxy-revalidate",
            );
            res.json({
                query: q,
                skills: skillsFilter,
                results: rows.map((r) => ({
                    id: r.id,
                    ename: r.ename,
                    name: r.name,
                    handle: r.handle,
                    bio: r.bio,
                    avatar: r.avatar ?? null,
                    headline: r.headline,
                    location: r.location,
                    skills: r.skills,
                    isVerified: r.isverified,
                })),
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
