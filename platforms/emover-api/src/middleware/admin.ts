import type { Request, Response, NextFunction } from "express";
import { UserRole } from "../database/entities/User";

export const adminGuard = (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
        return res.status(401).json({ error: "Authentication required" });
    }

    if (req.user.role !== UserRole.ADMIN) {
        return res.status(403).json({ error: "Admin access required" });
    }

    next();
};
