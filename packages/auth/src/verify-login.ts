import { verifySignature } from "signature-validator";
import type {
	LoginVerificationConfig,
	LoginVerificationResult,
} from "./types.js";

export async function verifyLoginSignature(
	config: LoginVerificationConfig,
): Promise<LoginVerificationResult> {
	const result = await verifySignature({
		eName: config.eName,
		signature: config.signature,
		payload: config.session,
		registryBaseUrl: config.registryBaseUrl,
	});

	return {
		valid: result.valid,
		error: result.error,
		publicKey: result.publicKey,
	};
}
