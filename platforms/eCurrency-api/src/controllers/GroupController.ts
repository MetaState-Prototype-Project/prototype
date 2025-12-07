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

            let limitNum = 10;
            if (typeof limit === "string") {
                const parsed = parseInt(limit, 10);
                if (!Number.isNaN(parsed) && parsed > 0 && parsed <= 100) {
                    limitNum = parsed;
                }
            }

            const groups = await this.groupService.searchGroups(q, limitNum);

            res.json(groups.map(group => ({
                id: group.id,
                name: group.name,
                ename: group.ename,
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

    getUserGroups = async (req: Request, res: Response) => {
        try {
            if (!req.user) {
                return res.status(401).json({ error: "Authentication required" });
            }

            const groups = await this.groupService.getUserGroups(req.user.id);
            
            // Check which groups the user is admin of
            const groupsWithAdminStatus = await Promise.all(
                groups.map(async (group) => {
                    const isAdmin = await this.groupService.isGroupAdmin(group.id, req.user!.id);
                    return {
                        id: group.id,
                        name: group.name,
                        ename: group.ename,
                        description: group.description,
                        isAdmin,
                        createdAt: group.createdAt,
                        updatedAt: group.updatedAt,
                    };
                })
            );

            res.json(groupsWithAdminStatus);
        } catch (error) {
            console.error("Error getting user groups:", error);
            res.status(500).json({ error: "Internal server error" });
        }
    };
}

