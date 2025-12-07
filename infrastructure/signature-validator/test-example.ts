/**
 * Test script to validate signatures using the signature-validator library
 * 
 * Edit the variables below to test different signatures, eNames, and payloads.
 */

import { verifySignature } from "./src/index";

// ============================================================================
// CONFIGURATION - Edit these values to test different signatures
// ============================================================================

const SIGNATURE = "WS/lLXhE6P++PPgyud1rEkKBUNgaKyvxunDadKltFq+beBJXcowf+0aneGyRB3hK+Cu6SRNL7e8QYjdpOZNvcQ=="
const ENAME = "@d12057f3-7447-5c87-b12b-32f59ea15294";
const PAYLOAD = "03edefec-92ab-4ebd-a758-3bf60547c07e"; // Replace with the actual payload that was signed

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
    console.log("Step 1: Fetching public key from eVault...");
    const result = await verifySignature({
      eName: ENAME,
      signature: SIGNATURE,
      payload: PAYLOAD,
      registryBaseUrl: REGISTRY_BASE_URL,
    });
    
    console.log("");
    console.log("=".repeat(70));
    console.log("DEBUG INFO");
    console.log("=".repeat(70));
    console.log(`Payload length: ${PAYLOAD.length} bytes`);
    console.log(`Payload (hex): ${Buffer.from(PAYLOAD, 'utf8').toString('hex')}`);
    console.log(`Signature length: ${SIGNATURE.length} chars`);
    console.log(`Signature (first 20 chars): ${SIGNATURE.substring(0, 20)}...`);
    if (result.publicKey) {
      console.log(`Public key retrieved: ${result.publicKey.substring(0, 50)}...`);
    }
    console.log("=".repeat(70));
    console.log("");

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
      console.log("=".repeat(70));
      console.log("TROUBLESHOOTING");
      console.log("=".repeat(70));
      console.log("Possible issues:");
      console.log("1. Public key from eVault doesn't match the key used to sign");
      console.log("2. Payload encoding mismatch (check for whitespace, case, etc.)");
      console.log("3. Signature was created with a different key than stored in eVault");
      console.log("");
      console.log("To debug:");
      console.log("- Verify the public key in eVault matches the signing key");
      console.log("- Check if payload has any hidden characters or encoding differences");
      console.log("- Ensure the signature was created with the same key stored in eVault");
      console.log("=".repeat(70));
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

