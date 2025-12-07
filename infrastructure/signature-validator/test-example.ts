/**
 * Test script to validate signatures using the signature-validator library
 * 
 * Edit the variables below to test different signatures, eNames, and payloads.
 */

import { verifySignature } from "./src/index";

// ============================================================================
// CONFIGURATION - Edit these values to test different signatures
// ============================================================================

const SIGNATURE = "Aa+ggCam4LJXA5TfXZpiiQcdAwVOln6JY8IUBVBPJNkRLLHIejIzb4vO58xl0k26o/LlKOVRP/Aw6qXncPEmpg=="
const ENAME = "@d12057f3-7447-5c87-b12b-32f59ea15294";
const PAYLOAD = "b156890e-0dbf-416f-bc25-eae93929cbf8"; // Replace with the actual payload that was signed

// Registry URL - defaults to staging
const REGISTRY_BASE_URL = process.env.REGISTRY_BASE_URL || "http://localhost:4321";

// ============================================================================

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
      console.log("      Edit the PAYLOAD variable at the top of the script to test different payloads.");
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

