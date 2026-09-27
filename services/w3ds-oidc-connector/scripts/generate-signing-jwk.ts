/**
 * Generates an ES256 private JWK for W3DS_OIDC_SIGNING_KEY_JWK.
 * Run from the repo root: pnpm --filter w3ds-oidc-connector generate-jwk
 */

import { generateSigningJwk } from "../src/keys.js";

async function main() {
    const jwk = await generateSigningJwk();
    process.stderr.write(
        "This key signs every ID token the connector issues. Keep it secret.\n" +
            "Rotating it invalidates tokens IdPs have already cached keys for.\n" +
            "Add this to your .env as W3DS_OIDC_SIGNING_KEY_JWK:\n\n",
    );
    process.stdout.write(`${JSON.stringify(jwk)}\n`);
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
