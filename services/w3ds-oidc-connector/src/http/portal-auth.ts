/**
 * Developer portal sessions. After a W3DS login the browser holds a signed,
 * HttpOnly, SameSite=Strict cookie naming the eName; every form carries a
 * CSRF token bound to that session as a second line of defence.
 */

import { randomBytes, timingSafeEqual } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { SignJWT, jwtVerify } from "jose";
import type { AppDeps } from "../app.js";
import { readCookie } from "./security.js";

const SESSION_SECONDS = 8 * 60 * 60;
const AUDIENCE = "w3ds-oidc-portal";

export interface PortalSession {
    /** The signed-in eName. */
    owner: string;
    csrf: string;
}

function cookieName(secure: boolean): string {
    return `${secure ? "__Host-" : ""}w3ds_portal`;
}

function isSecure(deps: AppDeps): boolean {
    return deps.config.issuer.startsWith("https:");
}

export async function startPortalSession(
    deps: AppDeps,
    res: Response,
    owner: string,
): Promise<void> {
    const now = Math.floor(deps.now() / 1000);
    const token = await new SignJWT({ csrf: randomBytes(24).toString("base64url") })
        .setProtectedHeader({ alg: "HS256" })
        .setSubject(owner)
        .setIssuer(deps.config.issuer)
        .setAudience(AUDIENCE)
        .setIssuedAt(now)
        .setExpirationTime(now + SESSION_SECONDS)
        .sign(deps.portalKey);
    const secure = isSecure(deps);
    const attributes = [
        `${cookieName(secure)}=${token}`,
        "Path=/",
        "HttpOnly",
        "SameSite=Strict",
        `Max-Age=${SESSION_SECONDS}`,
    ];
    if (secure) attributes.push("Secure");
    res.append("Set-Cookie", attributes.join("; "));
}

export function endPortalSession(deps: AppDeps, res: Response): void {
    const secure = isSecure(deps);
    const attributes = [
        `${cookieName(secure)}=`,
        "Path=/",
        "HttpOnly",
        "SameSite=Strict",
        "Max-Age=0",
    ];
    if (secure) attributes.push("Secure");
    res.append("Set-Cookie", attributes.join("; "));
}

export async function readPortalSession(
    deps: AppDeps,
    req: Request,
): Promise<PortalSession | null> {
    const token = readCookie(req, cookieName(isSecure(deps)));
    if (!token) return null;
    try {
        const { payload } = await jwtVerify(token, deps.portalKey, {
            algorithms: ["HS256"],
            issuer: deps.config.issuer,
            audience: AUDIENCE,
            currentDate: new Date(deps.now()),
        });
        if (typeof payload.sub !== "string" || typeof payload.csrf !== "string") {
            return null;
        }
        return { owner: payload.sub, csrf: payload.csrf };
    } catch {
        return null;
    }
}

/** The portal session of a request that passed `requirePortalSession`. */
export function portalSession(res: Response): PortalSession {
    return res.locals.portal as PortalSession;
}

/**
 * True if a form post's Origin is this service: the public issuer, or the
 * host the request actually arrived on (e.g. localhost during development).
 * `Origin: null` and any other site are refused.
 */
function isOwnOrigin(req: Request, issuer: string, origin: string): boolean {
    if (origin === issuer) return true;
    try {
        return new URL(origin).host === req.headers.host;
    } catch {
        return false;
    }
}

function csrfMatches(expected: string, actual: unknown): boolean {
    if (typeof actual !== "string") return false;
    const a = Buffer.from(expected);
    const b = Buffer.from(actual);
    return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Lets signed-in users through. Anyone else is sent to the login page (for a
 * page view) or refused (for a form post). Posts must also come from this
 * origin and carry the session's CSRF token.
 */
export function requirePortalSession(deps: AppDeps) {
    return async (req: Request, res: Response, next: NextFunction) => {
        try {
            const session = await readPortalSession(deps, req);
            if (req.method === "GET" || req.method === "HEAD") {
                if (!session) return res.redirect(303, "/portal/login");
            } else {
                const origin = req.headers.origin;
                if (
                    !session ||
                    (origin !== undefined &&
                        !isOwnOrigin(req, deps.config.issuer, origin)) ||
                    !csrfMatches(session.csrf, req.body?.csrf)
                ) {
                    return res
                        .status(403)
                        .type("text/plain")
                        .send("This form expired. Reload the page and try again.");
                }
            }
            res.locals.portal = session;
            next();
        } catch (error) {
            next(error);
        }
    };
}
