import { json } from "@sveltejs/kit";
import { parseAccessPolicy } from "@metastate-foundation/auth/platform";
import { publish } from "$lib/server/policy";
import { poll } from "$lib/server/session";
import type { RequestHandler } from "./$types";

/**
 * Polled while the wallet is deciding. Once it signs, the terms are published
 * into the owner's own eVault — the signature is checked again before the
 * write, so terms that cannot be verified never become the record.
 */
export const POST: RequestHandler = async ({ request, locals }) => {
	const { payload, statement } = (await request.json()) as {
		payload?: string;
		statement?: unknown;
	};
	if (!payload) return json({ error: "payload is required" }, { status: 400 });

	const result = poll(payload);
	if (result.status !== "done") return json({ status: result.status });

	if (result.ename !== locals.user!.ename) {
		return json(
			{ status: "rejected", error: "Those terms were signed by a different person." },
			{ status: 403 },
		);
	}

	const parsed = parseAccessPolicy(statement);
	if (!parsed) return json({ status: "rejected", error: "Malformed terms" }, { status: 400 });

	try {
		const id = await publish(parsed, payload, result.signature);
		return json({ status: "published", id });
	} catch (error) {
		console.error("[pp-auth-demo/terms] publish failed:", error);
		return json(
			{ status: "rejected", error: error instanceof Error ? error.message : "failed" },
			{ status: 500 },
		);
	}
};
