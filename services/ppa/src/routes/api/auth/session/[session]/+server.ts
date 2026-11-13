import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { isAdminEName, normalizeEName } from "$lib/server/allowlist";
import {
    AUTH_COOKIE_NAME,
    authCookieOptions,
    signAuthToken,
} from "$lib/server/token";
import { pollSession } from "$lib/server/w3ds";

/**
 * Polled by the login page. The whitelist gate lives here: a valid signature
 * from an eName that is not an approved PPA admin gets 403 and no cookie.
 */
export const GET: RequestHandler = async ({ params, cookies, url }) => {
    const result = pollSession(params.session);
    if (result.status === "unknown") {
        return json(
            {
                status: "expired",
                error: "This sign-in request expired. Start again.",
            },
            { status: 410 },
        );
    }
    if (result.status !== "authenticated") {
        return json({ status: "pending" });
    }

    const ename = normalizeEName(result.ename);
    if (!(await isAdminEName(ename))) {
        return json(
            {
                status: "forbidden",
                error: "You're not approved to review submissions.",
            },
            { status: 403 },
        );
    }

    cookies.set(
        AUTH_COOKIE_NAME,
        await signAuthToken(ename),
        authCookieOptions(url),
    );

    return json({ status: "authenticated", ename });
};
