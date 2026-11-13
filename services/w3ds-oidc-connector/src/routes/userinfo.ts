import { type Request, type Response, Router } from "express";
import type { AppDeps } from "../app.js";

export function userinfoRouter(deps: AppDeps): Router {
    const router = Router();

    const handler = (req: Request, res: Response) => {
        res.setHeader("Cache-Control", "no-store");
        const match = /^Bearer\s+([A-Za-z0-9_-]+)\s*$/i.exec(
            req.headers.authorization ?? "",
        );
        const entry = match && deps.tokens.get(match[1], deps.now());
        if (!entry) {
            res.setHeader("WWW-Authenticate", 'Bearer error="invalid_token"');
            res.status(401).json({ error: "invalid_token" });
            return;
        }
        res.json(entry.claims);
    };

    router.get("/userinfo", handler);
    router.post("/userinfo", handler);
    return router;
}
