import { afterEach, describe, expect, it } from "vitest";
import nacl from "tweetnacl";
import {
    computeBindingDocumentHash,
    getCanonicalBindingDocumentBytes,
} from "./binding-document-hash";
import {
    getProvisionerKeyPair,
    signAsProvisioner,
} from "./provisioner-signer";

describe("provisioner-signer", () => {
    const originalSeed = process.env.PROVISIONER_SIGNING_SEED;
    const originalProvisionerUrl = process.env.PUBLIC_PROVISIONER_URL;

    afterEach(() => {
        process.env.PROVISIONER_SIGNING_SEED = originalSeed;
        process.env.PUBLIC_PROVISIONER_URL = originalProvisionerUrl;
    });

    it("signAsProvisioner creates a valid Ed25519 detached signature", () => {
        process.env.PROVISIONER_SIGNING_SEED =
            "0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20";
        process.env.PUBLIC_PROVISIONER_URL = "https://provisioner.example.com";

        const doc = {
            subject: "@user-1",
            type: "id_document" as const,
            data: { vendor: "didit", reference: "abc", name: "Alice" },
        };
        const signature = signAsProvisioner(doc);
        const signatureBytes = Uint8Array.from(
            Buffer.from(
                signature.signature
                    .replace(/-/g, "+")
                    .replace(/_/g, "/")
                    .padEnd(Math.ceil(signature.signature.length / 4) * 4, "="),
                "base64",
            ),
        );
        const keyPair = getProvisionerKeyPair();

        const isValid = nacl.sign.detached.verify(
            getCanonicalBindingDocumentBytes(doc),
            signatureBytes,
            keyPair.publicKey,
        );
        expect(isValid).toBe(true);
    });

    it("computeBindingDocumentHash returns a sha256 hex digest", () => {
        const digest = computeBindingDocumentHash({
            subject: "@user-2",
            type: "self",
            data: { kind: "self", name: "Bob" },
        });
        expect(digest).toMatch(/^[a-f0-9]{64}$/);
    });
});
