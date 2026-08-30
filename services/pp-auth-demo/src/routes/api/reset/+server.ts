import { json } from "@sveltejs/kit";
import { resetWorld } from "$lib/server/world";
import type { RequestHandler } from "./$types";

export const POST: RequestHandler = async () => {
	await resetWorld();
	return json({ ok: true });
};
