#!/usr/bin/env node

/**
 * Script to generate a test JWT token for evault-core authentication
 * 
 * Usage:
 *   REGISTRY_ENTROPY_KEY_JWK='{"kty":"EC",...}' node generate-test-token.js
 * 
 * Or set the environment variable in a .env file
 * 
 * You can also use tsx to run it:
 *   REGISTRY_ENTROPY_KEY_JWK='...' npx tsx generate-test-token.js
 */

const { importJWK, SignJWT } = require("jose");
const dotenv = require("dotenv");
const path = require("path");

// Load .env file if it exists (try both root and current directory)
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });
dotenv.config({ path: path.resolve(__dirname, ".env") });

async function generateTestToken() {
  const jwkString = '{"kty":"EC","use":"sig","alg":"ES256","kid":"entropy-key-1","crv":"P-256","x":"POWUVJwOulAW0gheTVUHF4nXUenMCg0jxhGKI8M1LLU","y":"Cb4GC8Tt0gW7zMr-DhsDJisGVNgWttwjnyQl1HyU7hg","d":"FWqvWBzoiZcD0hh4JAMdJ7foxFRGqyV2Ei_eWvr1Si4"}';
  
  if (!jwkString) {
    console.error("Error: REGISTRY_ENTROPY_KEY_JWK environment variable is required");
    console.error("\nUsage:");
    console.error("  REGISTRY_ENTROPY_KEY_JWK='<your-jwk-json>' node generate-test-token.js");
    console.error("\nOr set it in your .env file");
    process.exit(1);
  }

  try {
    const jwk = JSON.parse(jwkString);
    const privateKey = await importJWK(jwk, "ES256");

    // Generate token valid for 1 year
    const token = await new SignJWT({
      // Add any custom claims you want
      platform: "eid-wallet",
      purpose: "public-key-sync",
    })
      .setProtectedHeader({
        alg: "ES256",
        kid: jwk.kid || "entropy-key-1",
      })
      .setIssuedAt()
      .setExpirationTime("1y") // Valid for 1 year
      .sign(privateKey);

    console.log("\n✅ Generated JWT Token (valid for 1 year):\n");
    console.log(token);
    console.log("\n📋 Use this token in the Authorization header:");
    console.log(`   Authorization: Bearer ${token}\n`);
    
    return token;
  } catch (error) {
    console.error("Error generating token:", error.message);
    if (error.message.includes("JSON")) {
      console.error("\nMake sure REGISTRY_ENTROPY_KEY_JWK is valid JSON");
    }
    process.exit(1);
  }
}

generateTestToken();

