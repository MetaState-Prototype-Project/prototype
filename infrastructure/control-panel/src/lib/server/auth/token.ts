import { env } from '$env/dynamic/private';
import { jwtVerify, SignJWT } from 'jose';

export const AUTH_COOKIE_NAME = 'control_panel_auth';
const AUTH_TOKEN_EXPIRY = '7d';

type AuthTokenPayload = {
	ename: string;
};

function getJwtSecret(): Uint8Array {
	const secret = env.CONTROL_PANEL_JWT_SECRET || 'control-panel-dev-secret-change-me';
	return new TextEncoder().encode(secret);
}

export async function signAuthToken(payload: AuthTokenPayload): Promise<string> {
	const secret = getJwtSecret();
	return await new SignJWT(payload)
		.setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
		.setIssuedAt()
		.setExpirationTime(AUTH_TOKEN_EXPIRY)
		.sign(secret);
}

export async function verifyAuthToken(token: string): Promise<AuthTokenPayload | null> {
	try {
		const secret = getJwtSecret();
		const { payload } = await jwtVerify(token, secret, {
			algorithms: ['HS256']
		});

		const ename = typeof payload.ename === 'string' ? payload.ename : null;
		if (!ename) return null;

		return { ename };
	} catch {
		return null;
	}
}
