import { AUTH_COOKIE_NAME, verifyAuthToken } from '$lib/server/auth/token';
import { json, redirect, type Handle } from '@sveltejs/kit';

const PUBLIC_PATHS = new Set(['/login']);

function isPublicPath(pathname: string): boolean {
	if (PUBLIC_PATHS.has(pathname)) return true;
	if (pathname.startsWith('/api/auth')) return true;
	if (pathname.startsWith('/_app')) return true;
	if (pathname === '/favicon.ico') return true;
	return false;
}

function withCorsHeaders(response: Response): Response {
	response.headers.set('Access-Control-Allow-Origin', '*');
	response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
	response.headers.set(
		'Access-Control-Allow-Headers',
		'Content-Type, Authorization, X-ENAME, Accept'
	);
	response.headers.set('Access-Control-Max-Age', '86400');
	response.headers.set('Access-Control-Allow-Private-Network', 'true');
	return response;
}

export const handle: Handle = async ({ event, resolve }) => {
	const token = event.cookies.get(AUTH_COOKIE_NAME);
	const auth = token ? await verifyAuthToken(token) : null;

	event.locals.user = auth ? { ename: auth.ename } : null;

	const pathname = event.url.pathname;
	const isApi = pathname.startsWith('/api/');

	if (event.request.method === 'OPTIONS') {
		if (event.request.headers.get('access-control-request-private-network') === 'true') {
			console.info('[auth] Private network preflight detected', { pathname });
		}
		return withCorsHeaders(new Response(null, { status: 204 }));
	}

	if (pathname.startsWith('/api/auth')) {
		console.info('[auth] Incoming request', {
			method: event.request.method,
			pathname,
			origin: event.url.origin,
			contentType: event.request.headers.get('content-type') || null,
			userAgent: event.request.headers.get('user-agent') || null
		});
	}

	const isPublic = isPublicPath(pathname);

	if (!event.locals.user && !isPublic) {
		if (isApi) {
			return withCorsHeaders(json({ error: 'Unauthorized' }, { status: 401 }));
		}
		throw redirect(302, '/login');
	}

	if (event.locals.user && pathname === '/login') {
		throw redirect(302, '/');
	}

	const response = await resolve(event);
	return withCorsHeaders(response);
};
