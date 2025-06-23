import { importJWK, SignJWT, KeyLike, generateKeyPair, exportJWK } from "jose";

let privateKey: KeyLike;
let publicKey: KeyLike;
let jwk: any;

// Helper function to generate initial JWK (run this once to get the JWK for your env)
export async function generateInitialJWK() {
  const { publicKey: pub, privateKey: priv } = await generateKeyPair("ES256", {
    extractable: true,
  });

  const jwk = await exportJWK(priv);
  jwk.kid = "entropy-key-1";
  jwk.alg = "ES256";
  jwk.use = "sig";

  return jwk;
}

async function initializeKeys() {
  if (!privateKey) {
    const jwkString = process.env.REGISTRY_ENTROPY_KEY_JWK;
    if (!jwkString) {
      throw new Error(
        "REGISTRY_ENTROPY_KEY_JWK environment variable is required"
      );
    }

    const jwk = JSON.parse(jwkString);
    privateKey = (await importJWK(jwk, "ES256")) as KeyLike;
    publicKey = (await importJWK({ ...jwk, d: undefined }, "ES256")) as KeyLike;
  }
}

// Generate 20 alphanumeric characters of entropy
function generateRandomEntropy(): string {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < 20; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Generate and sign a JWT containing entropy
export async function generateEntropy(): Promise<string> {
  await initializeKeys();
  const entropy = generateRandomEntropy();
  const token = await new SignJWT({ entropy })
    .setProtectedHeader({ alg: "ES256", kid: "entropy-key-1" })
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(privateKey);
  return token;
}

export async function generatePlatformToken(platform: string): Promise<string> {
  await initializeKeys();
  const token = await new SignJWT({ platform })
    .setProtectedHeader({ alg: "ES256", kid: "entropy-key-1" })
    .setIssuedAt()
    .setExpirationTime("1y")
    .sign(privateKey);
  return token;
}

// Get the JWK for verification
export async function getJWK(): Promise<any> {
  await initializeKeys();
  const jwkString = process.env.REGISTRY_ENTROPY_KEY_JWK;
  if (!jwkString) {
    throw new Error(
      "REGISTRY_ENTROPY_KEY_JWK environment variable is required"
    );
  }
  const jwk = JSON.parse(jwkString);
  return { keys: [{ ...jwk, d: undefined }] }; // Don't expose private key
}
