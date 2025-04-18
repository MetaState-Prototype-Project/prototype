export type LogEvent = {
	id: string;
	versionId: string;
	versionTime: Date;
	updateKeys: string[];
	nextKeyHashes: string[];
	method: `w3id:v${string}`;
	proof?: string;
};

export type VerifierCallback = (
	message: string,
	signature: string,
	pubKey: string,
) => Promise<boolean>;

export type JWTHeader = {
	alg: string;
	typ: "JWT";
	kid?: string;
};

export type JWTPayload = {
	[key: string]: unknown;
	iat?: number;
	exp?: number;
	nbf?: number;
	iss?: string;
	sub?: string;
	aud?: string;
	jti?: string;
};

export type Signer = {
	sign: (message: string) => Promise<string> | string;
	pubKey: string;
	alg: string;
};

export type RotationLogOptions = {
	nextKeyHashes: string[];
	nextKeySigner: Signer;
};

export type GenesisLogOptions = {
	nextKeyHashes: string[];
	id: string;
};

export function isGenesisOptions(
	options: CreateLogEventOptions,
): options is GenesisLogOptions {
	return "id" in options;
}
export function isRotationOptions(
	options: CreateLogEventOptions,
): options is RotationLogOptions {
	return "nextKeySigner" in options;
}

export type CreateLogEventOptions = GenesisLogOptions | RotationLogOptions;
