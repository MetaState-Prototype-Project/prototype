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

export type RotationLogOptions = {
	nextKeyHashes: string[];
	signer: Signer;
	nextKeySigner: Signer;
};

export type GenesisLogOptions = {
	nextKeyHashes: string[];
	id: string;
	signer: Signer;
};

export type Signer = {
	sign: (string: string) => Promise<string> | string;
	pubKey: string;
};

export type CreateLogEventOptions = GenesisLogOptions | RotationLogOptions;
