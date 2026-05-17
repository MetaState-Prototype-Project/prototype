import { Router } from "express";
import { w3dsAuthService } from "../services/W3dsAuthService";

/**
 * /api/auth - W3DS login for the portal. The portal requests an offer, the eID
 * wallet posts a signature to the callback, and the portal polls for the
 * resulting session JWT.
 */
export function authRouter(): Router {
    const router = Router();

    // Portal: start a login and get a w3ds://auth offer.
    router.post("/api/auth/offer", (_req, res) => {
        res.json(w3dsAuthService.createOffer());
    });

    // Wallet callback: verify the signed session id.
    router.post("/api/auth", async (req, res) => {
        const ename = req.body?.w3id ?? req.body?.ename;
        const { session, signature } = req.body ?? {};
        if (!ename || !session || !signature) {
            return res
                .status(400)
                .json({ error: "w3id, session and signature are required" });
        }
        const result = await w3dsAuthService.completeLogin(
            ename,
            session,
            signature,
        );
        if (!result.ok) {
            return res.status(401).json({ error: result.error });
        }
        res.json({ ok: true });
    });

    // Portal: poll until the wallet has signed in.
    router.get("/api/auth/session/:session", (req, res) => {
        res.json(w3dsAuthService.pollSession(req.params.session));
    });

    return router;
}
