/**
 * Generate an ES256 JWK for REGISTRY_ENTROPY_KEY_JWK. Outputs JWK JSON to stdout.
 * Run from repo root: pnpm generate-entropy-jwk
 */
const { generateKeyPair, exportJWK } = require("jose");

async function main() {
  const { privateKey } = await generateKeyPair("ES256", { extractable: true });
  const jwk = await exportJWK(privateKey);
  jwk.kid = "entropy-key-1";
  jwk.alg = "ES256";
  jwk.use = "sig";
  process.stdout.write("REGISTRY ENTROPY KEY GENERATED\n")
  process.stdout.write("-------------------------------------------------\n")
  process.stdout.write("this key is a secret and should not be shared\n");
  process.stdout.write("Add this to your .env:\n\n")


  process.stdout.write(JSON.stringify(jwk) + "\n");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
