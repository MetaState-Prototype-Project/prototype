import { Signer } from "../../src/types/w3id";

export function createMockSigner(alg: string = "ed25519"): Signer {
  return {
    sign: async (message: string): Promise<string> => {
      // Mock signature - in a real implementation this would be a proper signature
      return Buffer.from(message).toString("base64url");
    },
    pubKey: "mock-public-key",
    alg,
  };
}
