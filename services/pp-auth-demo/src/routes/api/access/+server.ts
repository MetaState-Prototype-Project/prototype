import { json } from "@sveltejs/kit";
import { attemptAccess } from "$lib/server/access";
import { world } from "$lib/server/world";
import type { RequestHandler } from "./$types";

export const POST: RequestHandler = async ({ request }) => {
	const body = (await request.json()) as {
		deploymentId?: string;
		domain?: string;
		kind?: string;
		text?: string;
	};
	const current = await world();
	const text = (body.text ?? "").trim();

	try {
		const outcome = await attemptAccess(
			current,
			String(body.deploymentId),
			String(body.domain),
			text ? { kind: body.kind || "Note", body: text } : undefined,
		);
		return json(outcome);
	} catch (error) {
		return json(
			{ error: error instanceof Error ? error.message : "failed" },
			{ status: 400 },
		);
	}
};
