import {
	errorResponse,
	getKnownPlatforms,
	getRateLimitConfig,
	requireAdmin
} from '$lib/server/rate-limits';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';

export const GET: RequestHandler = async ({ locals }) => {
	await requireAdmin(locals);
	try {
		const [config, knownPlatforms] = await Promise.all([
			getRateLimitConfig(),
			getKnownPlatforms()
		]);
		return json({ ...config, knownPlatforms });
	} catch (err) {
		return errorResponse(err);
	}
};
