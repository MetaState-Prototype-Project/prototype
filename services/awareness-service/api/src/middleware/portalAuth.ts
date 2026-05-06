import type { NextFunction, Request, Response } from "express";
import { config } from "../config";
import { w3dsAuthService } from "../services/W3dsAuthService";

/**
 * Authenticates a portal user by their W3DS session JWT (Authorization Bearer).
 * Sets `req.ename` and `req.isAdmin`.
 */
export function portalAuth(
    req: Request,
    res: Response,
    next: NextFunction,
): void {
    const header = req.header("authorization");
    if (!header?.startsWith("Bearer ")) {
        res.status(401).json({ error: "authentication required" });
        return;
    }
    const decoded = w3dsAuthService.verifyToken(header.slice(7).trim());
    if (!decoded) {
        res.status(401).json({ error: "invalid session token" });
        return;
    }
    req.ename = decoded.ename;
    req.isAdmin = config.adminEnames.includes(decoded.ename);
    next();
}

/** Requires the authenticated portal user to be an admin (AAAS_ADMIN_ENAMES). */
export function adminAuth(
    req: Request,
    res: Response,
    next: NextFunction,
): void {
    portalAuth(req, res, () => {
        if (!req.isAdmin) {
            res.status(403).json({ error: "admin access required" });
            return;
        }
        next();
    });
}
