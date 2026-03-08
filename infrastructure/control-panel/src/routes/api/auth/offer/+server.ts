import { env } from '$env/dynamic/public';
import { json, type RequestHandler } from '@sveltejs/kit';
import { createAuthSession } from '$lib/server/auth/sessions';

export const GET: RequestHandler = async ({ url }) => {
	const sessionId = createAuthSession();
	const baseUrl = env.PUBLIC_CONTROL_PANEL_URL || url.origin;
	const redirect = new URL('/api/auth', baseUrl).toString();
	const platform = 'control-panel';
	const uri = `w3ds://auth?redirect=${encodeURIComponent(redirect)}&session=${encodeURIComponent(sessionId)}&platform=${encodeURIComponent(platform)}`;
	console.info('[auth] Issued auth offer', {
		session: `${sessionId.slice(0, 8)}...`,
		baseUrl,
		redirect
	});

	return json({
		uri,
		sessionId,
		expiresInMs: 5 * 60 * 1000
	});
};
