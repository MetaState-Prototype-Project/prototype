/**
 * Bring-your-own-crypto adapter interface.
 * The SDK uses this for key generation, public key export, and signing;
 * it does not ship or mandate a concrete implementation.
 */
export interface CryptoAdapter {
  /**
   * Generate a new key pair. Returns an opaque keyId and the public key
   * in the format required by provisioning/whois (e.g. multibase).
   */
  generateKeyPair(): Promise<{ keyId: string; publicKey: string }>;

  /**
   * Get the public key for the given keyId (multibase or format required by protocol).
   */
  getPublicKey(keyId: string): Promise<string>;

  /**
   * Sign a payload string. Returns signature as base64 or multibase per protocol.
   */
  sign(keyId: string, payload: string): Promise<string>;
}
