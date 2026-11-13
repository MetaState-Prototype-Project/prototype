import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { completeLogin } from "$lib/server/w3ds";

/**
 * Wallet callback. Verifies the signature over the session id only — the
 * admin whitelist is enforced when the browser polls for the session, so an
 * unauthorised signature and an invalid one are indistinguishable here.
 */
export const POST: RequestHandler = async ({ request }) => {
    const body = await request.json().catch(() => null);
    const ename = body?.w3id ?? body?.ename;
    const session = body?.session;
    const signature = body?.signature;

    if (!ename || !session || !signature) {
        return json(
            { error: "w3id, session and signature are required" },
            { status: 400 },
        );
    }

    const result = await completeLogin(ename, session, signature);
    if (!result.ok) {
        // Log the detail, return a generic message: a caller must not be able
        // to tell "no such session" from "bad signature".
        console.warn("[ppa/auth] login rejected for", ename, "-", result.error);
        return json({ error: "Authentication failed" }, { status: 401 });
    }
    return json({ ok: true });
};
