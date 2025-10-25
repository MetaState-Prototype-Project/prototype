import { Request, Response } from "express";
import { GroupService } from "../services/GroupService";

export class GroupController {
    private groupService: GroupService;

    constructor() {
        this.groupService = new GroupService();
    }

    search = async (req: Request, res: Response) => {
        try {
            const { q, limit } = req.query;
            
            if (!q || typeof q !== "string") {
                return res.status(400).json({ error: "Query parameter 'q' is required" });
            }

            const limitNum = limit ? parseInt(limit as string) : 10;
            const groups = await this.groupService.searchGroups(q, limitNum);

            res.json(groups.map(group => ({
                id: group.id,
                name: group.name,
                description: group.description,
                charter: group.charter,
                createdAt: group.createdAt,
                updatedAt: group.updatedAt,
            })));
        } catch (error) {
            console.error("Error searching groups:", error);
            res.status(500).json({ error: "Internal server error" });
        }
    };
}
