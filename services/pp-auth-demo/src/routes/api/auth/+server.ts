import { json } from "@sveltejs/kit";
import { complete } from "$lib/server/session";
import type { RequestHandler } from "./$types";

/** Wallet callback for w3ds://auth. Field names vary by wallet build. */
export const POST: RequestHandler = async ({ request }) => {
	const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
	const session = String(body.session ?? body.sessionId ?? "");
	const ename = String(body.ename ?? body.w3id ?? body.eName ?? "");
	const signature = String(body.signature ?? "");

	if (!session || !ename || !signature) {
		return json({ error: "session, ename and signature are required" }, { status: 400 });
	}

	const result = await complete(session, ename, signature);
	if (!result.ok) {
		console.warn("[pp-auth-demo/auth] rejected:", result.error);
		return json({ error: result.error }, { status: 401 });
	}
	return json({ ok: true });
};
