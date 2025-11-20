import { Request, Response } from "express";
import { PlatformService } from "../services/PlatformService";

export class PlatformController {
    private platformService: PlatformService;

    constructor() {
        this.platformService = new PlatformService();
    }

    getPlatforms = async (req: Request, res: Response) => {
        try {
            const platforms = await this.platformService.getActivePlatforms();
            
            res.json({
                platforms: platforms.map(platform => ({
                    id: platform.id,
                    name: platform.name,
                    description: platform.description,
                    category: platform.category,
                    logoUrl: platform.logoUrl,
                    url: platform.url,
                    type: "platform"
                }))
            });
        } catch (error) {
            console.error("Error getting platforms:", error);
            res.status(500).json({ error: "Internal server error" });
        }
    };

    searchPlatforms = async (req: Request, res: Response) => {
        try {
            const { q } = req.query;
            
            if (!q || typeof q !== 'string') {
                return res.status(400).json({ error: "Query parameter 'q' is required" });
            }

            const platforms = await this.platformService.searchPlatforms(q);
            
            res.json({
                platforms: platforms.map(platform => ({
                    id: platform.id,
                    name: platform.name,
                    description: platform.description,
                    category: platform.category,
                    logoUrl: platform.logoUrl,
                    url: platform.url,
                    type: "platform"
                }))
            });
        } catch (error) {
            console.error("Error searching platforms:", error);
            res.status(500).json({ error: "Internal server error" });
        }
    };
}
