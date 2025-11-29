/// <reference path="../types/express.d.ts" />
import { Request, Response } from "express";

export class UserController {
    currentUser = async (req: Request, res: Response) => {
        try {
            if (!req.user) {
                return res.status(401).json({ error: "Authentication required" });
            }

            return res.json({
                id: req.user.id,
                ename: req.user.ename,
                name: req.user.name,
                createdAt: req.user.createdAt,
                updatedAt: req.user.updatedAt,
            });
        } catch (error) {
            console.error("Error getting current user:", error);
            return res.status(500).json({ error: "Internal server error" });
        }
    };
}

