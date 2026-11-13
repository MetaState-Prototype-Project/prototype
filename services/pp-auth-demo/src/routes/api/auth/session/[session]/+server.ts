import { json } from "@sveltejs/kit";
import { poll } from "$lib/server/session";
import { COOKIE, cookieOptions, mint } from "$lib/server/token";
import type { RequestHandler } from "./$types";

/** Polled by the login page until the wallet has answered. */
export const GET: RequestHandler = async ({ params, cookies, url }) => {
	const result = poll(params.session);
	if (result.status === "unknown") {
		return json({ status: "unknown" }, { status: 410 });
	}
	if (result.status !== "done") return json({ status: "pending" });

	cookies.set(COOKIE, mint(result.ename), cookieOptions(url));
	return json({ status: "authenticated", ename: result.ename });
};
