import { createHmac, timingSafeEqual } from "node:crypto";
import { jwtSecret } from "./env";

/** Signed session cookie. Nothing sensitive is in it beyond the eName. */

export const COOKIE = "pp_auth_demo_session";
const MAX_AGE_S = 7 * 24 * 3600;

function sign(value: string): string {
	return createHmac("sha256", jwtSecret()).update(value).digest("base64url");
}

export function mint(ename: string): string {
	const body = Buffer.from(
		JSON.stringify({ ename, exp: Date.now() + MAX_AGE_S * 1000 }),
		"utf8",
	).toString("base64url");
	return `${body}.${sign(body)}`;
}

export function read(token: string | undefined): { ename: string } | null {
	if (!token) return null;
	const [body, signature] = token.split(".");
	if (!body || !signature) return null;
	const expected = sign(body);
	if (
		expected.length !== signature.length ||
		!timingSafeEqual(Buffer.from(expected), Buffer.from(signature))
	) {
		return null;
	}
	try {
		const claims = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
		if (typeof claims.ename !== "string" || Date.now() > claims.exp) return null;
		return { ename: claims.ename };
	} catch {
		return null;
	}
}

/**
 * `secure` follows the actual scheme rather than SvelteKit's default, which
 * sets it for any non-localhost host. Over plain HTTP on a LAN address — how
 * this is reached from a phone — a Secure cookie is silently dropped and the
 * login appears to succeed on the server while the browser never advances.
 */
export function cookieOptions(url: URL) {
	return {
		path: "/",
		httpOnly: true,
		sameSite: "lax" as const,
		secure: url.protocol === "https:",
		maxAge: MAX_AGE_S,
	};
}
