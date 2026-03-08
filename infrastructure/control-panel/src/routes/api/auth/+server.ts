import { dev } from '$app/environment';
import { env } from '$env/dynamic/public';
import { isAdminEName, normalizeEName } from '$lib/server/auth/allowlist';
import { consumeAuthSession, publishAuthSessionResult } from '$lib/server/auth/sessions';
import { AUTH_COOKIE_NAME, signAuthToken } from '$lib/server/auth/token';
import { json, type RequestHandler } from '@sveltejs/kit';
import { createRequire } from 'node:module';

type VerifySignatureInput = {
	eName: string;
	signature: string;
	payload: string;
	registryBaseUrl: string;
};

type VerifySignatureOutput = {
	valid: boolean;
	error?: string;
};

const require = createRequire(import.meta.url);
let verifySignatureFn:
	| ((options: VerifySignatureInput) => Promise<VerifySignatureOutput>)
	| null = null;

async function verifyW3dsSignature(
	options: VerifySignatureInput
): Promise<VerifySignatureOutput> {
	if (!verifySignatureFn) {
		const signatureValidator = require('signature-validator') as {
			verifySignature: (input: VerifySignatureInput) => Promise<VerifySignatureOutput>;
		};
		verifySignatureFn = signatureValidator.verifySignature;
	}
	return verifySignatureFn(options);
}

type LoginBody = {
	ename?: string;
	w3id?: string;
	session?: string;
	signature?: string;
};

export const POST: RequestHandler = async ({ request, cookies }) => {
	try {
		const body = (await request.json()) as LoginBody;
		const ename = normalizeEName(body.ename || body.w3id || '');
		const session = body.session?.trim() || '';
		const signature = body.signature?.trim() || '';
		const sessionPreview = session ? `${session.slice(0, 8)}...` : '(missing)';
		const signaturePreview = signature
			? `${signature.slice(0, 12)}... (len=${signature.length})`
			: '(missing)';

		console.info('[auth] POST /api/auth received', {
			enameRaw: body.ename || body.w3id || null,
			enameNormalized: ename || null,
			session: sessionPreview,
			signature: signaturePreview
		});

		if (!ename || !session || !signature) {
			console.warn('[auth] Rejecting login: missing required fields', {
				hasEname: Boolean(ename),
				hasSession: Boolean(session),
				hasSignature: Boolean(signature)
			});
			return json({ error: 'Missing required fields' }, { status: 400 });
		}

		const hasSession = consumeAuthSession(session);
		if (!hasSession) {
			console.warn('[auth] Rejecting login: invalid or expired session', {
				ename,
				session: sessionPreview
			});
			return json({ error: 'Invalid or expired session' }, { status: 400 });
		}
		console.info('[auth] Session consumed successfully', { ename, session: sessionPreview });

		const registryBaseUrl = env.PUBLIC_REGISTRY_URL;
		if (!registryBaseUrl) {
			console.error('[auth] Missing PUBLIC_REGISTRY_URL');
			publishAuthSessionResult(session, { status: 'error', message: 'Server not configured' });
			return json({ error: 'Server configuration error' }, { status: 500 });
		}
		console.info('[auth] Verifying signature', {
			ename,
			session: sessionPreview,
			registryBaseUrl
		});

		const verificationResult = await verifyW3dsSignature({
			eName: ename,
			signature,
			payload: session,
			registryBaseUrl
		});

		if (!verificationResult.valid) {
			console.warn('[auth] Signature verification failed', {
				ename,
				session: sessionPreview,
				error: verificationResult.error || '(none)'
			});
			publishAuthSessionResult(session, { status: 'error', message: 'Invalid signature' });
			return json({ error: 'Invalid signature' }, { status: 401 });
		}
		console.info('[auth] Signature verified successfully', { ename, session: sessionPreview });

		const isAdmin = await isAdminEName(ename);
		if (!isAdmin) {
			console.warn('[auth] Rejecting login: eName not in admin allowlist', { ename });
			publishAuthSessionResult(session, { status: 'error', message: 'Not authorized' });
			return json({ error: 'Unauthorized' }, { status: 403 });
		}
		console.info('[auth] eName is in admin allowlist', { ename });

		const token = await signAuthToken({ ename });
		cookies.set(AUTH_COOKIE_NAME, token, {
			path: '/',
			httpOnly: true,
			sameSite: 'lax',
			secure: !dev,
			maxAge: 60 * 60 * 24 * 7
		});
		console.info('[auth] Login succeeded; auth cookie set', { ename, session: sessionPreview });

		publishAuthSessionResult(session, { status: 'success', ename });
		return json({ ok: true, ename });
	} catch (error) {
		console.error('[auth] Login failed:', error);
		return json({ error: 'Internal server error' }, { status: 500 });
	}
};
