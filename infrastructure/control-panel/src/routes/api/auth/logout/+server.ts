import { AUTH_COOKIE_NAME } from '$lib/server/auth/token';
import { json, type RequestHandler } from '@sveltejs/kit';

export const POST: RequestHandler = async ({ cookies }) => {
	cookies.delete(AUTH_COOKIE_NAME, { path: '/' });
	return json({ ok: true });
};
