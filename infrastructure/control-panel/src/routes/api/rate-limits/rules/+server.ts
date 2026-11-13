import { errorResponse, requireAdmin, saveRateLimitRule } from '$lib/server/rate-limits';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';

export const PUT: RequestHandler = async ({ locals, request }) => {
	const admin = await requireAdmin(locals);
	const body = await request.json().catch(() => null);
	if (!body || typeof body !== 'object' || Array.isArray(body)) {
		return json({ error: 'Expected a JSON object' }, { status: 400 });
	}
	try {
		return json({ rule: await saveRateLimitRule(body, admin) });
	} catch (err) {
		return errorResponse(err);
	}
};
