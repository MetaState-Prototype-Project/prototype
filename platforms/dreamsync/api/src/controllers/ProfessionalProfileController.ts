import type { Request, Response } from "express";
import { RegistryService } from "../services/RegistryService";
import { EVaultProfileService } from "../services/EVaultProfileService";

const registryService = new RegistryService();
const evaultService = new EVaultProfileService(registryService);

export class ProfessionalProfileController {
    async getProfile(req: Request, res: Response) {
        try {
            const ename = req.user?.ename;
            if (!ename) {
                return res.status(400).json({ error: "User ename not available" });
            }

            const profile = await evaultService.getProfile(ename);
            res.json(profile.professional);
        } catch (error: any) {
            console.error("Error fetching professional profile:", error.message);
            res.status(500).json({ error: "Failed to fetch professional profile" });
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
                "isDreamsyncVisible",
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
            console.error("Error updating professional profile:", error.message);
            res.status(500).json({ error: "Failed to update professional profile" });
        }
    }
}
