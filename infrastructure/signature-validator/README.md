# Signature Validator

A TypeScript library for verifying signatures using public keys retrieved from eVault.

## Installation

```bash
npm install
npm run build
```

## Usage

```typescript
import { verifySignature } from "signature-validator";

const result = await verifySignature({
  eName: "@user.w3id",
  signature: "z...", // multibase encoded signature
  payload: "message to verify",
  registryBaseUrl: "https://registry.example.com"
});

if (result.valid) {
  console.log("Signature is valid!");
} else {
  console.error("Signature invalid:", result.error);
}
```

## API

### `verifySignature(options: VerifySignatureOptions): Promise<VerifySignatureResult>`

Verifies a signature by:
1. Resolving the eVault URL from the registry using the eName
2. Fetching the public key from the eVault `/whois` endpoint
3. Decoding the multibase-encoded public key
4. Verifying the signature using Web Crypto API

#### Parameters

- `eName`: The eName (W3ID) of the user
- `signature`: The signature to verify (multibase encoded string, supports 'z' prefix for base58btc or base64)
- `payload`: The payload that was signed (string)
- `registryBaseUrl`: Base URL of the registry service

#### Returns

- `valid`: Boolean indicating if the signature is valid
- `error`: Error message if verification failed
- `publicKey`: The public key that was used for verification

## Public Key Format

Public keys are expected to be in multibase format starting with 'z':
- `z` prefix indicates multibase encoding
- Supports base58btc (standard) or hex encoding

Example: `z3059301306072a8648ce3d020106082a8648ce3d03010703420004a16b063e785d25945c44ae2e7a4cbd94c3316533427261244f696609d6afb848155b9016ad8d5c9ec59053b3b2cf2511af0c2414fc53d2abf96323bb1a031902`

## Signature Format

Signatures can be:
- Multibase encoded (starting with 'z' for base58btc)
- Base64 encoded (for software keys)

