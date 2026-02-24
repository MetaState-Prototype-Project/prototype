import type { Handle } from "@sveltejs/kit";

const API_PREFIX = "/api/";

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
    const isApiRoute = event.url.pathname.startsWith(API_PREFIX);

    if (isApiRoute && event.request.method === "OPTIONS") {
        return withCorsHeaders(new Response(null, { status: 204 }));
    }

    const response = await resolve(event);

    if (isApiRoute) {
        return withCorsHeaders(response);
    }

    return response;
};
