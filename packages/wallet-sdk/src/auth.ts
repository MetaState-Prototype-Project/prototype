import type { CryptoAdapter } from "./crypto-adapter.js";

export interface AuthenticateOptions {
	sessionId: string;
	keyId?: string;
	context: string;
}

export interface AuthenticateResult {
	signature: string;
}

/**
 * Ensure key exists and sign the session payload. Caller is responsible for POST to redirect URL or opening deeplink.
 */
export async function authenticate(
	adapter: CryptoAdapter,
	options: AuthenticateOptions,
): Promise<AuthenticateResult> {
	const keyId = options.keyId ?? "default";

	await adapter.ensureKey(keyId, options.context);
	const signature = await adapter.signPayload(
		keyId,
		options.context,
		options.sessionId,
	);
	return { signature };
}
