import { dev } from '$app/environment';
import { AUTH_COOKIE_NAME, signAuthToken } from '$lib/server/auth/token';
import { getAuthSessionResult } from '$lib/server/auth/sessions';
import { json, type RequestHandler } from '@sveltejs/kit';

type CompleteBody = {
	sessionId?: string;
};

export const POST: RequestHandler = async ({ request, cookies }) => {
	try {
		const body = (await request.json()) as CompleteBody;
		const sessionId = body.sessionId?.trim() || '';
		if (!sessionId) {
			return json({ error: 'Missing sessionId' }, { status: 400 });
		}

		const result = getAuthSessionResult(sessionId);
		if (!result || result.status !== 'success') {
			return json({ error: 'Session not authenticated' }, { status: 401 });
		}

		const token = await signAuthToken({ ename: result.ename });
		cookies.set(AUTH_COOKIE_NAME, token, {
			path: '/',
			httpOnly: true,
			sameSite: 'lax',
			secure: !dev,
			maxAge: 60 * 60 * 24 * 7
		});

		return json({ ok: true, ename: result.ename });
	} catch (error) {
		console.error('[auth] Complete login failed:', error);
		return json({ error: 'Internal server error' }, { status: 500 });
	}
};
