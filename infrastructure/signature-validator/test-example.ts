/**
 * Example test script with the provided signature and eName
 * 
 * This script tests the signature validation with:
 * - Signature: CL+njc5oRjD9C3KMgN+K+PPdsLsEI9z++it6t+92IZuMe1GRLrN779sBz5RVhoHbGbgDD84x/cb2lx/JCg8Fuw==
 * - eName: @d12057f3-7447-5c87-b12b-32f59ea15294
 * 
 * Note: You need to provide the payload that was signed. Common payloads for authentication:
 * - Session ID
 * - Offer string (w3ds://auth?redirect=...&session=...&platform=...)
 * - Combination of session + ename
 */

import { verifySignature } from "./src/index";

const SIGNATURE = "CL+njc5oRjD9C3KMgN+K+PPdsLsEI9z++it6t+92IZuMe1GRLrN779sBz5RVhoHbGbgDD84x/cb2lx/JCg8Fuw==";
const ENAME = "@d12057f3-7447-5c87-b12b-32f59ea15294";

// TODO: Replace with the actual payload that was signed
// Common examples:
// - Session ID: "some-session-id"
// - Offer string: "w3ds://auth?redirect=http://localhost:9888/api/auth&session=xxx&platform=ecurrency"
// - Custom message: "your-message-here"
const PAYLOAD = process.env.TEST_PAYLOAD || "test-payload-change-me";

// Registry URL - defaults to staging, can be overridden with REGISTRY_BASE_URL env var
const REGISTRY_BASE_URL = process.env.REGISTRY_BASE_URL || "https://registry.staging.metastate.foundation";

async function testSignature() {
  console.log("=".repeat(70));
  console.log("Signature Validation Test");
  console.log("=".repeat(70));
  console.log(`eName:        ${ENAME}`);
  console.log(`Signature:    ${SIGNATURE.substring(0, 50)}...`);
  console.log(`Payload:      ${PAYLOAD}`);
  console.log(`Registry URL: ${REGISTRY_BASE_URL}`);
  console.log("=".repeat(70));
  console.log("");

  try {
    console.log("Fetching public key from eVault...");
    console.log("Verifying signature...");
    console.log("");

    const result = await verifySignature({
      eName: ENAME,
      signature: SIGNATURE,
      payload: PAYLOAD,
      registryBaseUrl: REGISTRY_BASE_URL,
    });

    if (result.valid) {
      console.log("✅ SUCCESS: Signature is VALID");
      console.log("");
      if (result.publicKey) {
        console.log(`Public Key: ${result.publicKey}`);
      }
      process.exit(0);
    } else {
      console.log("❌ FAILED: Signature is INVALID");
      console.log("");
      if (result.error) {
        console.log(`Error: ${result.error}`);
      }
      console.log("");
      console.log("Note: Make sure the payload matches exactly what was signed.");
      console.log("      Set TEST_PAYLOAD environment variable to test different payloads:");
      console.log('      TEST_PAYLOAD="your-payload" npm run test:signature');
      process.exit(1);
    }
  } catch (error) {
    console.error("❌ ERROR during verification:");
    console.error("");
    if (error instanceof Error) {
      console.error(`Message: ${error.message}`);
      if (error.stack) {
        console.error("");
        console.error("Stack trace:");
        console.error(error.stack);
      }
    } else {
      console.error(String(error));
    }
    console.error("");
    process.exit(1);
  }
}

testSignature();

