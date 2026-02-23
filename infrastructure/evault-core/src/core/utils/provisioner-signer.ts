import nacl from "tweetnacl";
import { computeBindingDocumentHash } from "./binding-document-hash";
import type { BindingDocumentData, BindingDocumentType } from "../types/binding-document";

function hexToUint8Array(hex: string): Uint8Array {
    if (hex.length % 2 !== 0) throw new Error("Invalid hex string");
    const arr = new Uint8Array(hex.length / 2);
    for (let i = 0; i < arr.length; i++) {
        arr[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    }
    return arr;
}

function uint8ArrayToBase64url(arr: Uint8Array): string {
    const base64 = Buffer.from(arr).toString("base64");
    return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

export function getProvisionerKeyPair(): nacl.SignKeyPair {
    const seed = process.env.PROVISIONER_SIGNING_SEED;
    if (!seed) throw new Error("PROVISIONER_SIGNING_SEED is not set");
    const seedBytes = hexToUint8Array(seed);
    if (seedBytes.length !== 32) throw new Error("PROVISIONER_SIGNING_SEED must be a 32-byte hex string (64 hex chars)");
    return nacl.sign.keyPair.fromSeed(seedBytes);
}

export function getProvisionerKid(): string {
    return process.env.PROVISIONER_KID ?? "provisioner-1";
}

/**
 * Returns the provisioner's public key as an OKP JWK (Ed25519).
 */
export function getProvisionerJwk(): object {
    const kp = getProvisionerKeyPair();
    return {
        kty: "OKP",
        crv: "Ed25519",
        use: "sig",
        kid: getProvisionerKid(),
        x: uint8ArrayToBase64url(kp.publicKey),
    };
}

/**
 * Computes the provisioner signature for a binding document.
 * Per convention the signature field IS the MD5 hash of the canonical doc.
 * The signer field is the provisioner kid (not an eName).
 */
export function signAsProvisioner(doc: {
    subject: string;
    type: BindingDocumentType;
    data: BindingDocumentData;
}): { signer: string; signature: string; timestamp: string } {
    return {
        signer: getProvisionerKid(),
        signature: computeBindingDocumentHash(doc),
        timestamp: new Date().toISOString(),
    };
}
