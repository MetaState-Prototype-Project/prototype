import { deleteRateLimitRule, errorResponse, requireAdmin } from '$lib/server/rate-limits';
import type { RequestHandler } from '@sveltejs/kit';

export const DELETE: RequestHandler = async ({ locals, params }) => {
	const admin = await requireAdmin(locals);
	try {
		await deleteRateLimitRule(params.id ?? '', admin);
		return new Response(null, { status: 204 });
	} catch (err) {
		return errorResponse(err);
	}
};
