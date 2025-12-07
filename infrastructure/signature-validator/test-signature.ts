#!/usr/bin/env ts-node

/**
 * Test script to validate signatures using the signature-validator library
 * 
 * Usage:
 *   ts-node test-signature.ts <signature> <ename> <payload> [registryBaseUrl]
 * 
 * Example:
 *   ts-node test-signature.ts "CL+njc5oRjD9C3KMgN+K+PPdsLsEI9z++it6t+92IZuMe1GRLrN779sBz5RVhoHbGbgDD84x/cb2lx/JCg8Fuw==" "@d12057f3-7447-5c87-b12b-32f59ea15294" "test payload"
 */

import { verifySignature } from "./src/index";

async function main() {
  // Parse command line arguments
  const args = process.argv.slice(2);
  
  if (args.length < 3) {
    console.error("Usage: ts-node test-signature.ts <signature> <ename> <payload> [registryBaseUrl]");
    console.error("");
    console.error("Example:");
    console.error('  ts-node test-signature.ts "CL+njc5oRjD9C3KMgN+K+PPdsLsEI9z++it6t+92IZuMe1GRLrN779sBz5RVhoHbGbgDD84x/cb2lx/JCg8Fuw==" "@d12057f3-7447-5c87-b12b-32f59ea15294" "test payload"');
    process.exit(1);
  }

  const [signature, ename, payload, registryBaseUrl] = args;
  
  // Default registry URL
  const registryUrl = registryBaseUrl || 
    process.env.REGISTRY_BASE_URL || 
    "https://registry.staging.metastate.foundation";

  console.log("=".repeat(60));
  console.log("Signature Validation Test");
  console.log("=".repeat(60));
  console.log(`eName:        ${ename}`);
  console.log(`Signature:    ${signature}`);
  console.log(`Payload:      ${payload}`);
  console.log(`Registry URL: ${registryUrl}`);
  console.log("=".repeat(60));
  console.log("");

  try {
    console.log("Verifying signature...");
    const result = await verifySignature({
      eName,
      signature,
      payload,
      registryBaseUrl: registryUrl,
    });

    console.log("");
    if (result.valid) {
      console.log("✅ Signature is VALID");
      if (result.publicKey) {
        console.log(`Public Key: ${result.publicKey}`);
      }
    } else {
      console.log("❌ Signature is INVALID");
      if (result.error) {
        console.log(`Error: ${result.error}`);
      }
    }
    console.log("");

    process.exit(result.valid ? 0 : 1);
  } catch (error) {
    console.error("");
    console.error("❌ Error during verification:");
    console.error(error instanceof Error ? error.message : String(error));
    console.error("");
    process.exit(1);
  }
}

main();

