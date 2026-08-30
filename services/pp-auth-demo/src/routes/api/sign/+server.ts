import { json } from "@sveltejs/kit";
import { complete } from "$lib/server/session";
import type { RequestHandler } from "./$types";

/**
 * Wallet callback for w3ds://sign.
 *
 * The wallet signs the session id and posts it back as `message`. For the
 * owner's terms that session id is the canonical payload of the statement, so
 * this signature is over the terms themselves — the page polling
 * /api/terms/status is what turns it into a published record.
 *
 * Field names vary between wallet builds, so accept the shapes in use.
 */
export const POST: RequestHandler = async ({ request }) => {
	const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
	const session = String(body.sessionId ?? body.session ?? "");
	const ename = String(body.w3id ?? body.ename ?? body.eName ?? "");
	const signature = String(body.signature ?? "");

	if (!session || !ename || !signature) {
		return json(
			{ error: "sessionId, w3id and signature are required" },
			{ status: 400 },
		);
	}

	// The wallet echoes what it signed; if it disagrees with the session we are
	// tracking, something has been substituted along the way.
	const message = body.message === undefined ? session : String(body.message);
	if (message !== session) {
		return json({ error: "signed payload does not match the session" }, { status: 400 });
	}

	const result = await complete(session, ename, signature);
	if (!result.ok) {
		console.warn("[pp-auth-demo/sign] rejected:", result.error);
		return json({ error: result.error }, { status: 401 });
	}
	return json({ ok: true });
};
