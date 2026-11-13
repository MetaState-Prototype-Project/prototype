import { isReservedPayload } from "@metastate-foundation/delegation";
import { verifySignature } from "signature-validator";
import type {
	LoginVerificationConfig,
	LoginVerificationResult,
} from "./types.js";

export async function verifyLoginSignature(
	config: LoginVerificationConfig,
): Promise<LoginVerificationResult> {
	// A signature made for a company or over a grant is never a login.
	if (typeof config.session === "string" && isReservedPayload(config.session)) {
		return { valid: false, error: "reserved_payload" };
	}
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
