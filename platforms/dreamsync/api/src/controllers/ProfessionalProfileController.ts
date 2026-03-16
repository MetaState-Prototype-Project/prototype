import type { Request, Response } from "express";
import { RegistryService } from "../services/RegistryService";
import { EVaultProfileService } from "../services/EVaultProfileService";

const registryService = new RegistryService();
const evaultService = new EVaultProfileService(registryService);

/**
 * Extract HTTP status from upstream errors (eVault, Registry, graphql-request).
 * Returns 404 when the upstream indicates not found, otherwise 500.
 */
function getHttpStatusFromError(error: unknown): number {
    if (!error || typeof error !== "object") return 500;
    const e = error as Record<string, unknown>;
    const status =
        (e.response as { status?: number })?.status ??
        (e.status as number) ??
        (e.statusCode as number);
    if (typeof status === "number" && status >= 400 && status < 600) return status;
    const msg = String(e.message ?? "").toLowerCase();
    if (msg.includes("404") || msg.includes("not found")) return 404;
    return 500;
}

export class ProfessionalProfileController {
    async getProfile(req: Request, res: Response) {
        try {
            const ename = req.user?.ename;
            if (!ename) {
                return res.status(400).json({ error: "User ename not available" });
            }

            const w3id = ename.startsWith("@") ? ename : `@${ename}`;
            console.log(
                "[ProfessionalProfile] GET profile for ename:",
                ename,
                "-> w3id:",
                w3id,
            );

            const profile = await evaultService.getProfile(ename);
            res.json(profile.professional);
        } catch (error: any) {
            const status = getHttpStatusFromError(error);
            const message =
                status === 404
                    ? "Professional profile not found"
                    : "Failed to fetch professional profile";
            console.error(
                "[ProfessionalProfile] Error fetching profile:",
                error.message,
                "full:",
                JSON.stringify(error?.response?.data ?? error),
            );
            res.status(status).json({ error: message });
        }
    }

    async updateProfile(req: Request, res: Response) {
        try {
            const ename = req.user?.ename;
            if (!ename) {
                return res.status(400).json({ error: "User ename not available" });
            }

            const allowedFields = [
                "headline",
                "bio",
                "location",
                "skills",
                "workExperience",
                "education",
                "isPublic",
            ];

            const updateData: Record<string, unknown> = {};
            for (const field of allowedFields) {
                if (req.body[field] !== undefined) {
                    updateData[field] = req.body[field];
                }
            }

            const profile = await evaultService.upsertProfile(ename, updateData);
            res.json(profile.professional);
        } catch (error: any) {
            const status = getHttpStatusFromError(error);
            const message =
                status === 404
                    ? "Professional profile not found"
                    : "Failed to update professional profile";
            console.error("Error updating professional profile:", error.message);
            res.status(status).json({ error: message });
        }
    }
}
