import { SignJWT, jwtVerify } from "jose";
import { jwtSecret } from "./env";

/**
 * The PPA admin session: an HS256 JWT held in an httpOnly cookie. Distinct
 * from the ES256 accreditation key in jwt.ts — this one only says "you are
 * logged in", it never leaves the app.
 */

export const AUTH_COOKIE_NAME = "ppa_auth";
const SESSION_TTL = "7d";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

/**
 * Cookie attributes for the admin session.
 *
 * `secure` follows the scheme actually in use rather than SvelteKit's default,
 * which sets Secure for any host that is not localhost. Reached over a LAN
 * address on plain HTTP — how this app is used when signing in from a phone —
 * that default makes the browser discard the cookie without a word, so the
 * login succeeds and the session never sticks. Over HTTPS this is still Secure.
 */
export function authCookieOptions(url: URL) {
    return {
        path: "/",
        httpOnly: true,
        sameSite: "lax" as const,
        secure: url.protocol === "https:",
        maxAge: SESSION_TTL_SECONDS,
    };
}

function secret(): Uint8Array {
    return new TextEncoder().encode(jwtSecret());
}

export async function signAuthToken(ename: string): Promise<string> {
    return new SignJWT({ ename })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime(SESSION_TTL)
        .sign(secret());
}

export async function verifyAuthToken(
    token: string,
): Promise<{ ename: string } | null> {
    try {
        const { payload } = await jwtVerify(token, secret());
        return typeof payload.ename === "string" ? { ename: payload.ename } : null;
    } catch {
        return null;
    }
}
