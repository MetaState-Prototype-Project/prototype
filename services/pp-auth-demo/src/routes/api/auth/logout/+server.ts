import { redirect } from "@sveltejs/kit";
import { COOKIE, cookieOptions } from "$lib/server/token";
import type { RequestHandler } from "./$types";

export const POST: RequestHandler = async ({ cookies, url }) => {
	cookies.delete(COOKIE, cookieOptions(url));
	throw redirect(303, "/login");
};
