export interface AuthUser {
	id: string;
	ename: string;
	[key: string]: unknown;
}

export interface JwtPayload {
	userId: string;
	[key: string]: unknown;
}

export interface AuthMiddlewareConfig {
	secret: string;
	findUser: (userId: string) => Promise<AuthUser | null>;
}

export interface AuthOfferConfig {
	baseUrl: string;
	platform: string;
	callbackPath?: string;
}

export interface LoginVerificationConfig {
	eName: string;
	signature: string;
	session: string;
	registryBaseUrl: string;
}

export interface LoginVerificationResult {
	valid: boolean;
	error?: string;
	publicKey?: string;
}
