import express, { type Response, Router } from "express";
import QRCode from "qrcode";
import type { AppDeps } from "../app.js";
import {
    endPortalSession,
    portalSession,
    readPortalSession,
    requirePortalSession,
    startPortalSession,
} from "../http/portal-auth.js";
import {
    clearBindingCookie,
    htmlSecurityHeaders,
    newBrowserSecret,
    readBindingCookie,
    setBindingCookie,
} from "../http/security.js";
import { authorizePage } from "../views/authorize.js";
import { messagePage } from "../views/messages.js";
import { portalHomePage } from "../views/portal.js";
import { walletLink } from "./authorize.js";

export function portalRouter(deps: AppDeps): Router {
    const router = Router();
    const { config } = deps;
    const secure = config.issuer.startsWith("https:");
    const forms = express.urlencoded({ extended: false, limit: "16kb" });
    const signedIn = requirePortalSession(deps);

    const loginFailed = (res: Response, message: string) => {
        const nonce = htmlSecurityHeaders(res);
        res.status(400).send(
            messagePage({ nonce, title: "Sign-in failed", message, tone: "error" }),
        );
    };

    router.get("/portal/login", async (req, res, next) => {
        try {
            if (await readPortalSession(deps, req)) {
                return res.redirect(303, "/portal");
            }
            const browserSecret = newBrowserSecret();
            const session = deps.sessions.create(
                { kind: "portal" },
                browserSecret,
                deps.now(),
            );
            setBindingCookie(res, session.id, browserSecret, {
                secure,
                maxAgeSeconds: config.sessionTtlSeconds + 120,
            });
            const link = walletLink({
                issuer: config.issuer,
                sessionId: session.id,
                platformName: config.platformName,
            });
            const qrSvg = await QRCode.toString(link, {
                type: "svg",
                errorCorrectionLevel: "M",
                margin: 1,
            });
            const nonce = htmlSecurityHeaders(res);
            res.send(
                authorizePage({
                    nonce,
                    platformName: config.platformName,
                    heading: "Sign in to the developer portal",
                    walletLink: link,
                    qrSvg,
                    eventsUrl: `/w3ds/events/${session.id}`,
                    expiresAt: session.expiresAt,
                }),
            );
        } catch (error) {
            next(error);
        }
    });

    // The login page's event stream sends the browser here once the wallet
    // has signed; only the browser that opened the QR code can complete.
    router.get("/portal/login/complete", async (req, res, next) => {
        try {
            const sessionId = req.query.session;
            if (typeof sessionId !== "string") {
                return loginFailed(res, "This sign-in link is incomplete.");
            }
            const lookup = deps.sessions.lookup(sessionId, deps.now());
            if (lookup.state !== "live" || lookup.session.purpose.kind !== "portal") {
                return loginFailed(res, "This sign-in has expired. Start again.");
            }
            const session = deps.sessions.claim(
                sessionId,
                readBindingCookie(req, sessionId, secure),
                deps.now(),
            );
            if (!session?.identity) {
                return loginFailed(
                    res,
                    "Finish signing in in the browser where you opened the QR code.",
                );
            }
            clearBindingCookie(res, sessionId, secure);
            await startPortalSession(deps, res, session.identity.eName);
            res.redirect(303, "/portal");
        } catch (error) {
            next(error);
        }
    });

    router.post("/portal/logout", forms, signedIn, (_req, res) => {
        endPortalSession(deps, res);
        res.redirect(303, "/portal/login");
    });

    router.get("/portal", signedIn, (_req, res) => {
        const nonce = htmlSecurityHeaders(res, { forms: true });
        res.send(portalHomePage({ nonce, session: portalSession(res) }));
    });

    return router;
}
