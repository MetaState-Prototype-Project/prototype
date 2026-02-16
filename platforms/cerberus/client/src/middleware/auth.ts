import { Request, Response, NextFunction } from "express";
import { AppDataSource } from "../database/data-source";
import { User } from "../database/entities/User";
import { verifyToken } from "../utils/jwt";

// Extend Express Request type to include user
declare global {
    namespace Express {
        interface Request {
            user?: User;
        }
    }
}

export const authMiddleware = async (
    req: Request,
    res: Response,
    next: NextFunction,
) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader?.startsWith("Bearer ")) {
            return next();
        }

        const token = authHeader.split(" ")[1];
        const decoded = verifyToken(token) as { userId: string };

        if (!decoded?.userId) {
            return res.status(401).json({ error: "Invalid token" });
        }

        const userRepository = AppDataSource.getRepository(User);
        const user = await userRepository.findOneBy({ id: decoded.userId });

        if (!user) {
            return res.status(401).json({ error: "User not found" });
        }

        req.user = user;
        next();
    } catch (error) {
        console.error("Auth middleware error:", error);
        res.status(401).json({ error: "Invalid token" });
    }
};

export const authGuard = (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
        return res.status(401).json({ error: "Authentication required" });
    }
    next();
}; 