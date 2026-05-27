import * as crypto from "node:crypto";
import { env } from "$env/dynamic/private";
import { PUBLIC_REGISTRY_URL } from "$env/static/public";
import axios from "axios";
import { GraphQLClient, gql } from "graphql-request";
import { evaultService } from "./evault";

/**
 * After a successful claim, write an audit binding doc onto the user's eVault
 * recording who notarised the recovery. Rides on the existing
 * `social_connection` binding-doc type with `kind: "notary_recovery_attestation"`
 * so we don't need a server-side schema enum change. Existing personal-binding
 * readers filter by kind and ignore unknowns.
 *
 * Fire-and-forget from the claim handler — if this write fails, the user has
 * still been recovered. The audit is nice-to-have, not load-bearing.
 */

const CREATE_BINDING_DOC = gql`
    mutation CreateBindingDocument($input: CreateBindingDocumentInput!) {
        createBindingDocument(input: $input) {
            metaEnvelopeId
            errors {
                message
                code
            }
        }
    }
`;

export interface RecoveryAuditFields {
    targetEName: string;
    notaryEName: string;
    sessionId: string;
    issuedAt: number;
    claimedAt: number;
}

/**
 * eVault's createBindingDocument validates the owner signature, but accepts a
 * "legacy" mode where the signature is just the SHA-256 of the canonical doc
 * (see BindingDocumentService.ts:271 — `hasLegacyHashSignature`). The notary
 * isn't producing a real ECDSA signature here; we're recording an event, not
 * staking the user's identity. The legacy hash path is the appropriate one.
 */
function stableStringify(value: unknown): string {
    if (value === null || typeof value !== "object") {
        return JSON.stringify(value);
    }
    if (Array.isArray(value)) {
        return `[${value.map((item) => stableStringify(item)).join(",")}]`;
    }
    const record = value as Record<string, unknown>;
    const keys = Object.keys(record).sort();
    const entries = keys.map(
        (key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`,
    );
    return `{${entries.join(",")}}`;
}

function bindingDocHash(doc: {
    subject: string;
    type: string;
    data: unknown;
}): string {
    const canonical = stableStringify(doc);
    return crypto.createHash("sha256").update(canonical, "utf8").digest("hex");
}

function getRegistryUrl(): string {
    const url =
        env.REGISTRY_URL || env.PUBLIC_REGISTRY_URL || PUBLIC_REGISTRY_URL;
    if (!url) throw new Error("REGISTRY_URL or PUBLIC_REGISTRY_URL is required");
    return url;
}

async function getPlatformToken(): Promise<string> {
    const endpoint = new URL("/platforms/certification", getRegistryUrl()).toString();
    const response = await axios.post<{ token: string }>(
        endpoint,
        { platform: "enotary" },
        { timeout: 10_000 },
    );
    return response.data.token;
}

export async function writeRecoveryAudit(
    fields: RecoveryAuditFields,
): Promise<void> {
    const targetEName = evaultService.normalizeEName(fields.targetEName);
    const notaryEName = evaultService.normalizeEName(fields.notaryEName);

    const evaultBaseUrl = await evaultService.resolveEVaultUrl(targetEName);
    const token = await getPlatformToken();

    const client = new GraphQLClient(
        new URL("/graphql", evaultBaseUrl).toString(),
        {
            headers: {
                Authorization: `Bearer ${token}`,
                "X-ENAME": targetEName,
            },
        },
    );

    const data = {
        kind: "notary_recovery_attestation",
        notaryEName,
        sessionId: fields.sessionId,
        issuedAt: new Date(fields.issuedAt).toISOString(),
        claimedAt: new Date(fields.claimedAt).toISOString(),
    };

    const docForHash = {
        subject: targetEName,
        type: "social_connection",
        data,
    };

    const input = {
        subject: targetEName,
        type: "social_connection",
        data,
        ownerSignature: {
            signer: notaryEName,
            signature: bindingDocHash(docForHash),
            timestamp: new Date(fields.claimedAt).toISOString(),
        },
    };

    await client.request(CREATE_BINDING_DOC, { input });
}
