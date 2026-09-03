import { json } from "@sveltejs/kit";
import { reset } from "$lib/server/walkthrough";
import type { RequestHandler } from "./$types";

/**
 * Puts the world at beat zero.
 *
 * Provisions the cast if it does not exist yet — eight eVaults, one at a time,
 * because each needs its own entropy token — then writes the group's manifest
 * and Alice's note. Safe to call again: it is also the "start over" button.
 */
export const POST: RequestHandler = async () => {
	try {
		const cast = await reset();
		return json({ ok: true, members: cast.members.length });
	} catch (error) {
		return json(
			{ ok: false, error: error instanceof Error ? error.message : String(error) },
			{ status: 500 },
		);
	}
};
