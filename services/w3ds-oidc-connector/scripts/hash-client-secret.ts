/**
 * Hashes a client secret for W3DS_OIDC_CLIENTS.
 *
 *   pnpm --filter w3ds-oidc-connector hash-secret --generate
 *       prints a new random secret and its hash
 *   echo -n "<secret>" | pnpm --filter w3ds-oidc-connector hash-secret
 *       hashes a secret read from stdin
 */

import { randomBytes } from "node:crypto";
import { hashSecret } from "../src/secrets.js";

async function readStdin(): Promise<string> {
    const chunks: Buffer[] = [];
    for await (const chunk of process.stdin) chunks.push(Buffer.from(chunk));
    return Buffer.concat(chunks).toString("utf8").replace(/\r?\n$/, "");
}

async function main() {
    if (process.argv.includes("--generate")) {
        const secret = randomBytes(32).toString("base64url");
        process.stdout.write(`client_secret:      ${secret}\n`);
        process.stdout.write(`client_secret_hash: ${await hashSecret(secret)}\n`);
        return;
    }
    if (process.stdin.isTTY) {
        process.stderr.write(
            "pipe the secret on stdin, or pass --generate for a new one\n",
        );
        process.exit(1);
    }
    const secret = await readStdin();
    if (!secret) {
        process.stderr.write("empty secret\n");
        process.exit(1);
    }
    process.stdout.write(`${await hashSecret(secret)}\n`);
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
