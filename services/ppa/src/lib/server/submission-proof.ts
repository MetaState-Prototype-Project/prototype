import { createHash } from "node:crypto";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { registryUrl } from "./env";
import type { PPASubmissionProof, PPASubmissionStatement } from "./ontology";

const PAYLOAD_PREFIX = "gitw3:ppa:v1:";
const STATEMENT_TYPE = "w3ds.ppa.release-submission";
const MAX_SIGNING_AGE_MS = 16 * 60 * 1000;
const BASE58_ALPHABET =
    "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const jwks = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

function string(value: unknown): string {
    return typeof value === "string" ? value.trim() : "";
}

function strings(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    return value.map(string).filter(Boolean);
}

function sameStrings(left: string[], right: string[]): boolean {
    return (
        left.length === right.length &&
        left.every((value, i) => value === right[i])
    );
}

function decodeHex(value: string): Uint8Array {
    if (value.length % 2 !== 0 || !/^[0-9a-f]+$/i.test(value)) {
        throw new Error("invalid hex value");
    }
    return Uint8Array.from(Buffer.from(value, "hex"));
}

function decodeBase58(value: string): Uint8Array {
    const bytes: number[] = [];
    for (const character of value) {
        const digit = BASE58_ALPHABET.indexOf(character);
        if (digit < 0) throw new Error("invalid base58 value");
        let carry = digit;
        for (let i = 0; i < bytes.length; i += 1) {
            carry += bytes[i] * 58;
            bytes[i] = carry & 0xff;
            carry >>= 8;
        }
        while (carry > 0) {
            bytes.push(carry & 0xff);
            carry >>= 8;
        }
    }
    let leadingZeroes = 0;
    for (const character of value) {
        if (character !== "1") break;
        leadingZeroes += 1;
    }
    return Uint8Array.from([
        ...Array.from({ length: leadingZeroes }, () => 0),
        ...bytes.reverse(),
    ]);
}

function decodePublicKey(value: string): Uint8Array {
    if (/^0x[0-9a-f]+$/i.test(value)) return decodeHex(value.slice(2));
    if (value.startsWith("f")) return decodeHex(value.slice(1));
    if (value.startsWith("m"))
        return Uint8Array.from(Buffer.from(value.slice(1), "base64"));
    if (!value.startsWith("z"))
        return Uint8Array.from(Buffer.from(value, "base64"));
    const encoded = value.slice(1);
    if (/^[0-9a-f]+$/i.test(encoded) && encoded.length % 2 === 0) {
        return decodeHex(encoded);
    }
    return decodeBase58(encoded);
}

function arrayBuffer(value: Uint8Array): ArrayBuffer {
    return Uint8Array.from(value).buffer;
}

function looksLikeDerSignature(value: Uint8Array): boolean {
    if (value.length < 8 || value[0] !== 0x30 || value[1] !== value.length - 2)
        return false;
    const rLength = value[3];
    if (value[2] !== 0x02 || 4 + rLength >= value.length) return false;
    if (value[4 + rLength] !== 0x02) return false;
    const sLength = value[5 + rLength];
    return 6 + rLength + sLength === value.length;
}

function derSignatureToRaw(value: Uint8Array): Uint8Array {
    if (!looksLikeDerSignature(value)) return value;
    const rLength = value[3];
    const r = value.slice(4, 4 + rLength);
    const sLength = value[5 + rLength];
    const s = value.slice(6 + rLength, 6 + rLength + sLength);
    const raw = new Uint8Array(64);
    const normalizedR = r[0] === 0 ? r.slice(1) : r;
    const normalizedS = s[0] === 0 ? s.slice(1) : s;
    if (normalizedR.length > 32 || normalizedS.length > 32) {
        throw new Error("invalid ECDSA signature integers");
    }
    raw.set(normalizedR, 32 - normalizedR.length);
    raw.set(normalizedS, 64 - normalizedS.length);
    return raw;
}

function signatureCandidates(value: string): Uint8Array[] {
    const candidates: Uint8Array[] = [];
    try {
        candidates.push(Uint8Array.from(Buffer.from(value, "base64url")));
    } catch {
        // Try the multibase representation below.
    }
    if (value.startsWith("z")) {
        try {
            candidates.push(decodeBase58(value.slice(1)));
        } catch {
            // The value may simply be a base64 signature beginning with z.
        }
    }
    return candidates;
}

function parseStatement(value: unknown): PPASubmissionStatement | null {
    if (!value || typeof value !== "object") return null;
    const raw = value as Record<string, unknown>;
    const statement: PPASubmissionStatement = {
        type: string(raw.type) as PPASubmissionStatement["type"],
        schemaVersion: Number(raw.schemaVersion) as 1,
        repositoryId: Number(raw.repositoryId),
        repository: string(raw.repository),
        platformEName: string(raw.platformEName),
        platformName: string(raw.platformName),
        releaseTag: string(raw.releaseTag),
        version: string(raw.version),
        manifestCommitId: string(raw.manifestCommitId),
        domains: strings(raw.domains),
        signerEName: string(raw.signerEName),
        issuedAt: string(raw.issuedAt),
        nonce: string(raw.nonce),
    };
    const previousDecision = string(raw.previousDecision);
    const previousDecisionAt = string(raw.previousDecisionAt);
    if (previousDecision || previousDecisionAt) {
        if (previousDecision !== "denied" || !previousDecisionAt) return null;
        statement.previousDecision = "denied";
        statement.previousDecisionAt = previousDecisionAt;
    }
    if (
        statement.type !== STATEMENT_TYPE ||
        statement.schemaVersion !== 1 ||
        !Number.isSafeInteger(statement.repositoryId) ||
        statement.repositoryId <= 0 ||
        !statement.repository ||
        !statement.platformEName.startsWith("@") ||
        !statement.platformName ||
        !statement.releaseTag ||
        !statement.version ||
        !statement.manifestCommitId ||
        statement.domains.length === 0 ||
        !statement.signerEName.startsWith("@") ||
        !statement.nonce
    ) {
        return null;
    }
    return statement;
}

function canonicalPayload(statement: PPASubmissionStatement): string {
    const digest = createHash("sha256")
        .update(JSON.stringify(statement))
        .digest("base64url");
    return `${PAYLOAD_PREFIX}${digest}`;
}

async function verifyWalletSignature(
    proof: PPASubmissionProof,
): Promise<boolean> {
    const verifiedAt = new Date(proof.verifiedAt);
    const registry = registryUrl();
    const jwksUrl = new URL("/.well-known/jwks.json", registry).toString();
    let registryKeys = jwks.get(jwksUrl);
    if (!registryKeys) {
        registryKeys = createRemoteJWKSet(new URL(jwksUrl));
        jwks.set(jwksUrl, registryKeys);
    }
    const { payload } = await jwtVerify(
        proof.keyBindingCertificate,
        registryKeys,
        {
            algorithms: ["ES256"],
            currentDate: verifiedAt,
            requiredClaims: ["exp"],
        },
    );
    const certificateEName = string(
        payload.ename ?? payload.eName ?? payload.w3id,
    );
    const certificateKey = string(payload.publicKey);
    if (
        certificateEName !== proof.statement.signerEName ||
        !certificateKey ||
        certificateKey !== proof.publicKey
    ) {
        return false;
    }

    const keyBytes = decodePublicKey(proof.publicKey);
    const key = await crypto.subtle.importKey(
        keyBytes.length === 65 && keyBytes[0] === 0x04 ? "raw" : "spki",
        arrayBuffer(keyBytes),
        { name: "ECDSA", namedCurve: "P-256" },
        false,
        ["verify"],
    );
    const encodedPayload = arrayBuffer(new TextEncoder().encode(proof.payload));
    for (const candidate of signatureCandidates(proof.signature)) {
        try {
            if (
                await crypto.subtle.verify(
                    { name: "ECDSA", hash: "SHA-256" },
                    key,
                    arrayBuffer(derSignatureToRaw(candidate)),
                    encodedPayload,
                )
            ) {
                return true;
            }
        } catch {
            // Try the next supported signature encoding.
        }
    }
    return false;
}

/**
 * Validates the durable release evidence independently of GitW3. The
 * certificate is checked at the original verification time so a legitimate
 * historical proof remains auditable after its short-lived certificate ends.
 */
export async function verifySubmissionProof(
    value: unknown,
    profile: Record<string, unknown>,
    ename: string,
    requestedDomains: string[],
): Promise<PPASubmissionProof | null> {
    if (!value || typeof value !== "object") return null;
    const raw = value as Record<string, unknown>;
    const statement = parseStatement(raw.statement);
    if (!statement) return null;
    const proof: PPASubmissionProof = {
        statement,
        payload: string(raw.payload),
        signature: string(raw.signature),
        publicKey: string(raw.publicKey),
        keyBindingCertificate: string(raw.keyBindingCertificate),
        verifiedAt: string(raw.verifiedAt),
    };
    const issuedAt = Date.parse(statement.issuedAt);
    const verifiedAt = Date.parse(proof.verifiedAt);
    if (
        statement.platformEName !== ename ||
        statement.platformName !== string(profile.platformName) ||
        statement.version !== string(profile.version) ||
        statement.version !== string(profile.submissionVersion) ||
        !sameStrings(statement.domains, requestedDomains) ||
        proof.payload !== canonicalPayload(statement) ||
        !proof.signature ||
        !proof.publicKey ||
        !proof.keyBindingCertificate ||
        !Number.isFinite(issuedAt) ||
        !Number.isFinite(verifiedAt) ||
        verifiedAt < issuedAt ||
        verifiedAt - issuedAt > MAX_SIGNING_AGE_MS ||
        verifiedAt > Date.now() + 5 * 60 * 1000
    ) {
        return null;
    }
    return (await verifyWalletSignature(proof)) ? proof : null;
}

export function submissionSupersedesDecision(
    proof: PPASubmissionProof,
    decision: { decision: "granted" | "denied"; createdAt: string },
): boolean {
    return (
        decision.decision === "denied" &&
        proof.statement.previousDecision === "denied" &&
        proof.statement.previousDecisionAt === decision.createdAt &&
        Date.parse(proof.verifiedAt) > Date.parse(decision.createdAt)
    );
}
