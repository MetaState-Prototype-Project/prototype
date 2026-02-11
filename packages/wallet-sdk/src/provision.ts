import type { CryptoAdapter } from "./crypto-adapter.js";

export interface ProvisionOptions {
	registryUrl: string;
	provisionerUrl: string;
	namespace: string;
	verificationId: string;
	keyId?: string;
	context?: string;
	isPreVerification?: boolean;
}

export interface ProvisionResult {
	success: boolean;
	w3id: string;
	uri: string;
}

/**
 * Provision an eVault: get entropy from registry, get public key from adapter, POST to provisioner.
 */
export async function provision(
	adapter: CryptoAdapter,
	options: ProvisionOptions,
): Promise<ProvisionResult> {
	const keyId = options.keyId ?? "default";
	const context =
		options.context ??
		(options.isPreVerification ? "pre-verification" : "onboarding");

	const entropyUrl = new URL("/entropy", options.registryUrl).toString();
	const entropyRes = await fetch(entropyUrl);
	if (!entropyRes.ok) {
		throw new Error(
			`Failed to get entropy: ${entropyRes.status} ${entropyRes.statusText}`,
		);
	}
	const entropyData = (await entropyRes.json()) as { token?: string };
	const registryEntropy = entropyData.token;
	if (!registryEntropy) {
		throw new Error("Registry did not return entropy token");
	}

	const publicKey = await adapter.getPublicKey(keyId, context);
	if (!publicKey) {
		throw new Error(
			`No public key for keyId=${keyId} context=${context}. Ensure key exists before provisioning.`,
		);
	}

	const provisionUrl = new URL("/provision", options.provisionerUrl).toString();
	const provisionRes = await fetch(provisionUrl, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			registryEntropy,
			namespace: options.namespace,
			verificationId: options.verificationId,
			publicKey,
		}),
	});

	if (!provisionRes.ok) {
		const text = await provisionRes.text();
		throw new Error(
			`Provision failed: ${provisionRes.status} ${provisionRes.statusText} ${text}`,
		);
	}

	const data = (await provisionRes.json()) as {
		success?: boolean;
		w3id?: string;
		uri?: string;
	};
	if (!data.success || !data.w3id || !data.uri) {
		throw new Error("Invalid provision response: missing success, w3id, or uri");
	}

	return {
		success: data.success,
		w3id: data.w3id,
		uri: data.uri,
	};
}
