import { json } from "@sveltejs/kit";
import { load as loadCast } from "$lib/server/cast";
import { runBeat } from "$lib/server/walkthrough";
import type { RequestHandler } from "./$types";

/** Runs one beat of the walkthrough against the live eVault. */
export const POST: RequestHandler = async ({ request }) => {
	const body = (await request.json()) as { index?: number };
	const cast = await loadCast();
	if (!cast) return json({ ok: false, error: "The stage has not been set." }, { status: 404 });
	if (typeof body.index !== "number") {
		return json({ ok: false, error: "A beat index is required." }, { status: 400 });
	}
	try {
		return json({ ok: true, result: await runBeat(cast, body.index) });
	} catch (error) {
		return json(
			{ ok: false, error: error instanceof Error ? error.message : String(error) },
			{ status: 500 },
		);
	}
};
