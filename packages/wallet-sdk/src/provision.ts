import type { CryptoAdapter } from "./crypto-adapter";

/** Options for provisioning a new eVault identity. */
export interface ProvisionOptions {
  /** BYOC crypto adapter for key generation and public key export. */
  cryptoAdapter: CryptoAdapter;
  /** Base URL of the registry (e.g. https://registry.example.com). */
  registryUrl: string;
  /** Base URL of the provisioner (e.g. https://provisioner.example.com). */
  provisionerUrl: string;
  /** Optional namespace (UUID). If omitted, a new UUID is generated. */
  namespace?: string;
  /** Optional verification ID. If omitted, the default demo code is used. */
  verificationId?: string;
}

/** Result of a successful provision call. Caller is responsible for persisting these. */
export interface ProvisionResult {
  /** W3ID (eName) for the provisioned identity. */
  w3id: string;
  /** eVault URI for the provisioned identity. */
  uri: string;
  /** Key ID from the adapter used for this identity (for later sign/sync). */
  keyId: string;
}

const DEFAULT_VERIFICATION_ID = "d66b7138-538a-465f-a6ce-f6985854c3f4";

/**
 * Provisions a new eVault identity using the registry and provisioner.
 * Does not persist anything; the caller must store w3id, uri, and keyId.
 */
export async function provision(
  options: ProvisionOptions
): Promise<ProvisionResult> {
  const {
    cryptoAdapter,
    registryUrl,
    provisionerUrl,
    namespace = crypto.randomUUID(),
    verificationId = DEFAULT_VERIFICATION_ID,
  } = options;

  const { keyId, publicKey } = await cryptoAdapter.generateKeyPair();

  const registryBase = registryUrl.replace(/\/$/, "");
  const entropyRes = await fetch(`${registryBase}/entropy`);
  if (!entropyRes.ok) {
    throw new Error(
      `Registry entropy failed: ${entropyRes.status} ${entropyRes.statusText}`
    );
  }
  const entropyJson = (await entropyRes.json()) as { token?: string };
  const registryEntropy = entropyJson.token;
  if (!registryEntropy) {
    throw new Error("Registry did not return an entropy token");
  }

  const provisionerBase = provisionerUrl.replace(/\/$/, "");
  const provisionRes = await fetch(`${provisionerBase}/provision`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      registryEntropy,
      namespace,
      verificationId,
      publicKey,
    }),
  });

  const provisionBody = (await provisionRes.json()) as {
    success?: boolean;
    w3id?: string;
    uri?: string;
    error?: string;
    message?: string;
  };

  if (!provisionRes.ok || !provisionBody.success) {
    const msg =
      provisionBody.message ||
      provisionBody.error ||
      `${provisionRes.status} ${provisionRes.statusText}`;
    throw new Error(`Provision failed: ${msg}`);
  }

  if (!provisionBody.w3id || !provisionBody.uri) {
    throw new Error("Provision response missing w3id or uri");
  }

  return {
    w3id: provisionBody.w3id,
    uri: provisionBody.uri,
    keyId,
  };
}
