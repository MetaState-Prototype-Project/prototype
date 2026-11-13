import { json, redirect, type Handle } from "@sveltejs/kit";
import { isAdminEName } from "$lib/server/allowlist";
import {
    AUTH_COOKIE_NAME,
    authCookieOptions,
    verifyAuthToken,
} from "$lib/server/token";

/**
 * Everything behind the admin whitelist by default. Only the login page, the
 * auth endpoints the wallet talks to, and the JWK set are public — the JWKS in
 * particular must stay reachable unauthenticated or nobody outside the PPA can
 * verify a statement it issued.
 */

const PUBLIC_PATHS = new Set(["/login"]);

function isPublicPath(pathname: string): boolean {
    if (PUBLIC_PATHS.has(pathname)) return true;
    if (pathname.startsWith("/api/auth")) return true;
    if (pathname.startsWith("/.well-known/")) return true;
    if (pathname.startsWith("/_app")) return true;
    if (pathname === "/favicon.ico") return true;
    return false;
}

/**
 * The eID wallet POSTs the signed session from its own webview origin with a
 * JSON content type, which makes it a preflighted cross-origin request. Without
 * these headers the browser never sends the POST at all and the wallet reports
 * a generic authentication failure with nothing reaching us.
 *
 * `Access-Control-Allow-Private-Network` is what lets a webview on the phone
 * reach this app on a LAN address at all — Chrome blocks public-to-private
 * requests without it. Same handling as infrastructure/control-panel.
 */
function withCorsHeaders(response: Response): Response {
    response.headers.set("Access-Control-Allow-Origin", "*");
    response.headers.set(
        "Access-Control-Allow-Methods",
        "GET, POST, OPTIONS",
    );
    response.headers.set(
        "Access-Control-Allow-Headers",
        "Content-Type, Authorization, X-ENAME, Accept",
    );
    response.headers.set("Access-Control-Max-Age", "86400");
    response.headers.set("Access-Control-Allow-Private-Network", "true");
    return response;
}

export const handle: Handle = async ({ event, resolve }) => {
    const pathname = event.url.pathname;

    // Answer the preflight before any auth work — it carries no credentials.
    if (event.request.method === "OPTIONS") {
        if (
            event.request.headers.get("access-control-request-private-network") ===
            "true"
        ) {
            console.info("[ppa/auth] private-network preflight", { pathname });
        }
        return withCorsHeaders(new Response(null, { status: 204 }));
    }

    if (pathname.startsWith("/api/auth")) {
        console.info("[ppa/auth] incoming", {
            method: event.request.method,
            pathname,
            origin: event.request.headers.get("origin"),
            contentType: event.request.headers.get("content-type"),
        });
    }

    const token = event.cookies.get(AUTH_COOKIE_NAME);
    const auth = token ? await verifyAuthToken(token) : null;

    // The allowlist is re-checked on every request rather than trusted from
    // the session: dropping an eName from the whitelist must revoke it now,
    // not whenever their week-long cookie happens to expire. The allowlist is
    // mtime-cached, so this costs nothing per request.
    if (auth && !(await isAdminEName(auth.ename))) {
        console.warn(
            "[ppa/auth] session presented by a no-longer-whitelisted eName:",
            auth.ename,
        );
        event.cookies.delete(AUTH_COOKIE_NAME, authCookieOptions(event.url));
        event.locals.user = null;
    } else {
        event.locals.user = auth ? { ename: auth.ename } : null;
    }

    if (!event.locals.user && !isPublicPath(pathname)) {
        if (pathname.startsWith("/api/")) {
            return withCorsHeaders(
                json({ error: "Unauthorized" }, { status: 401 }),
            );
        }
        throw redirect(302, "/login");
    }

    if (event.locals.user && pathname === "/login") {
        throw redirect(302, "/");
    }

    return withCorsHeaders(await resolve(event));
};
