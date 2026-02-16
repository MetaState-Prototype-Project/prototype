import { Request, Response, NextFunction } from "express";
import { AppDataSource } from "../database/data-source";
import { User } from "../database/entities/User";
import { verifyToken } from "../utils/jwt";

export const authMiddleware = async (
    req: Request,
    res: Response,
    next: NextFunction,
) => {
    try {
        // Check for token in Authorization header or query parameter
        let token: string | undefined;
        
        const authHeader = req.headers.authorization;
        if (authHeader?.startsWith("Bearer ")) {
            token = authHeader.split(" ")[1];
        } else if (req.query.token) {
            token = req.query.token as string;
        }

        if (!token) {
            return next();
        }

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

