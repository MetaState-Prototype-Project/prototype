import { errorResponse, getRateLimitUsage, requireAdmin } from '$lib/server/rate-limits';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';

export const GET: RequestHandler = async ({ locals }) => {
	await requireAdmin(locals);
	try {
		return json(await getRateLimitUsage());
	} catch (err) {
		return errorResponse(err);
	}
};
