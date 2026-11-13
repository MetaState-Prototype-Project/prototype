import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { AUTH_COOKIE_NAME, authCookieOptions } from "$lib/server/token";

export const POST: RequestHandler = async ({ cookies, url }) => {
    cookies.delete(AUTH_COOKIE_NAME, authCookieOptions(url));
    return json({ ok: true });
};
