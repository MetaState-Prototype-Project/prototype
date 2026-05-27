import type { Handle } from "@sveltejs/kit";

// Cross-origin endpoints — anything fetched by the eID wallet (or another
// platform) from a different origin needs the CORS dance. /api/* covers the
// recovery + witness endpoints, /.well-known/* covers the JWKS the wallet
// fetches to verify notary-signed recovery JWTs.
const CORS_PREFIXES = ["/api/", "/.well-known/"];

function isCorsRoute(pathname: string): boolean {
    return CORS_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

function withCorsHeaders(response: Response): Response {
    response.headers.set("Access-Control-Allow-Origin", "*");
    response.headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    response.headers.set(
        "Access-Control-Allow-Headers",
        "Content-Type, Authorization, X-ENAME",
    );
    response.headers.set("Access-Control-Max-Age", "86400");
    return response;
}

export const handle: Handle = async ({ event, resolve }) => {
    const corsRoute = isCorsRoute(event.url.pathname);

    if (corsRoute && event.request.method === "OPTIONS") {
        return withCorsHeaders(new Response(null, { status: 204 }));
    }

    const response = await resolve(event);

    if (corsRoute) {
        return withCorsHeaders(response);
    }

    return response;
};
