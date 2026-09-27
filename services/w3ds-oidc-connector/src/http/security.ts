import { randomBytes } from "node:crypto";
import type { Request, Response } from "express";

/** Headers for every HTML page; returns the CSP nonce for inline code. */
export function htmlSecurityHeaders(res: Response): string {
    const nonce = randomBytes(16).toString("base64");
    res.setHeader(
        "Content-Security-Policy",
        [
            "default-src 'none'",
            `script-src 'nonce-${nonce}'`,
            `style-src 'nonce-${nonce}'`,
            "img-src data:",
            "connect-src 'self'",
            "base-uri 'none'",
            "form-action 'none'",
            "frame-ancestors 'none'",
        ].join("; "),
    );
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("Cache-Control", "no-store");
    return nonce;
}

/**
 * The browser-binding cookie ties a login session to the browser that opened
 * /authorize. Anyone can read S off the QR code and get a wallet to sign it,
 * but only the holder of this cookie can collect the resulting code.
 */
export function bindingCookieName(sessionId: string, secure: boolean): string {
    return `${secure ? "__Host-" : ""}w3ds_oidc_${sessionId}`;
}

export function newBrowserSecret(): string {
    return randomBytes(32).toString("base64url");
}

export function setBindingCookie(
    res: Response,
    sessionId: string,
    secret: string,
    options: { secure: boolean; maxAgeSeconds: number },
): void {
    const attributes = [
        `${bindingCookieName(sessionId, options.secure)}=${secret}`,
        "Path=/",
        "HttpOnly",
        "SameSite=Lax",
        `Max-Age=${options.maxAgeSeconds}`,
    ];
    if (options.secure) attributes.push("Secure");
    res.append("Set-Cookie", attributes.join("; "));
}

export function readCookie(req: Request, name: string): string | undefined {
    const header = req.headers.cookie;
    if (!header) return undefined;
    for (const part of header.split(";")) {
        const separator = part.indexOf("=");
        if (separator < 0) continue;
        if (part.slice(0, separator).trim() === name) {
            return part.slice(separator + 1).trim();
        }
    }
    return undefined;
}

export function readBindingCookie(
    req: Request,
    sessionId: string,
    secure: boolean,
): string | undefined {
    return readCookie(req, bindingCookieName(sessionId, secure));
}

export function clearBindingCookie(
    res: Response,
    sessionId: string,
    secure: boolean,
): void {
    const attributes = [
        `${bindingCookieName(sessionId, secure)}=`,
        "Path=/",
        "HttpOnly",
        "SameSite=Lax",
        "Max-Age=0",
    ];
    if (secure) attributes.push("Secure");
    res.append("Set-Cookie", attributes.join("; "));
}
