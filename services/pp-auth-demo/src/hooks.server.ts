import { redirect, type Handle } from "@sveltejs/kit";
import { COOKIE, read } from "$lib/server/token";

const PUBLIC_PATHS = new Set(["/login"]);

function isPublic(pathname: string): boolean {
	if (PUBLIC_PATHS.has(pathname)) return true;
	if (pathname.startsWith("/api/auth")) return true;
	if (pathname.startsWith("/api/sign")) return true;
	// The verifier endpoints are for deployments, which have no session.
	if (pathname.startsWith("/pp-auth/")) return true;
	return false;
}

/**
 * The wallet posts its callback from a phone, cross-origin, so the callback
 * routes need CORS — including the private-network preflight Chrome sends when
 * a public page calls a LAN address.
 */
function cors(response: Response): Response {
	response.headers.set("Access-Control-Allow-Origin", "*");
	response.headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
	response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
	response.headers.set("Access-Control-Allow-Private-Network", "true");
	response.headers.set("Access-Control-Max-Age", "86400");
	return response;
}

export const handle: Handle = async ({ event, resolve }) => {
	event.locals.user = read(event.cookies.get(COOKIE));

	if (event.request.method === "OPTIONS") {
		return cors(new Response(null, { status: 204 }));
	}

	const { pathname } = event.url;
	if (!event.locals.user && !isPublic(pathname)) {
		if (pathname.startsWith("/api/")) {
			return cors(new Response("Unauthorized", { status: 401 }));
		}
		throw redirect(302, "/login");
	}
	if (event.locals.user && pathname === "/login") throw redirect(302, "/platforms");

	return cors(await resolve(event));
};
