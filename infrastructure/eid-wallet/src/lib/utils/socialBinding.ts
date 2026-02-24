/**
 * Cross-vault helpers for social binding operations.
 *
 * These are intentionally standalone (no VaultController dependency) so they
 * can be called from both the ePassport page (requester) and scanLogic (signer)
 * with only the caller's eName + auth token available.
 */

import {
    PUBLIC_EID_WALLET_TOKEN,
    PUBLIC_REGISTRY_URL,
} from "$env/static/public";

export interface BindingDocParsed {
    subject: string;
    type: string;
    data: Record<string, unknown>;
    signatures: Array<{ signer: string; signature: string; timestamp: string }>;
}

export interface BindingDocEdge {
    node: {
        id: string;
        parsed: BindingDocParsed | null;
    };
}

// ---------------------------------------------------------------------------
// Registry resolution
// ---------------------------------------------------------------------------

/**
 * Resolve an eName to its eVault GraphQL endpoint via the registry.
 */
export async function resolveVaultUri(ename: string): Promise<string> {
    const normalized = ename.startsWith("@") ? ename : `@${ename}`;
    const url = new URL(
        `resolve?w3id=${encodeURIComponent(normalized)}`,
        PUBLIC_REGISTRY_URL,
    );
    const res = await fetch(url.toString(), { method: "GET" });
    if (!res.ok)
        throw new Error(
            `Registry could not resolve ${normalized}: ${res.status}`,
        );
    const json = await res.json();
    if (!json?.uri)
        throw new Error(`Registry returned no URI for ${normalized}`);
    const base = json.uri as string;
    return base.endsWith("/graphql")
        ? base
        : new URL("/graphql", base).toString();
}

// ---------------------------------------------------------------------------
// Generic cross-vault GraphQL request
// ---------------------------------------------------------------------------

/**
 * Execute a GraphQL query/mutation against any eVault endpoint.
 *
 * @param gqlUrl  - The full /graphql URL of the target vault.
 * @param callerEname - The eName of the caller (used as X-ENAME header).
 * @param query   - GraphQL operation string.
 * @param variables - Variables for the operation.
 */
export async function vaultGqlRequest<T = unknown>(
    gqlUrl: string,
    callerEname: string,
    query: string,
    variables?: Record<string, unknown>,
): Promise<T> {
    const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "X-ENAME": callerEname.startsWith("@")
            ? callerEname
            : `@${callerEname}`,
    };
    if (PUBLIC_EID_WALLET_TOKEN) {
        headers.Authorization = `Bearer ${PUBLIC_EID_WALLET_TOKEN}`;
    }

    const res = await fetch(gqlUrl, {
        method: "POST",
        headers,
        body: JSON.stringify({ query, variables }),
    });

    if (!res.ok) throw new Error(`GraphQL request failed: ${res.status}`);
    const json = await res.json();
    if (json.errors?.length) {
        throw new Error(
            json.errors.map((e: { message: string }) => e.message).join("; "),
        );
    }
    return json.data as T;
}

// ---------------------------------------------------------------------------
// Name extraction from binding documents
// ---------------------------------------------------------------------------

const BINDING_DOCS_QUERY = `
    query {
        bindingDocuments(first: 10) {
            edges {
                node {
                    id
                    parsed
                }
            }
        }
    }
`;

const USER_PROFILE_QUERY = `
    query GetUserProfile($ontologyId: ID!) {
        metaEnvelopes(filter: { ontologyId: $ontologyId }, first: 1) {
            edges {
                node {
                    parsed
                }
            }
        }
    }
`;

const USER_ONTOLOGY_ID = "550e8400-e29b-41d4-a716-446655440000";

interface BindingDocsResult {
    bindingDocuments: { edges: BindingDocEdge[] };
}

interface UserProfileResult {
    metaEnvelopes: {
        edges: Array<{ node: { parsed: Record<string, unknown> | null } }>;
    };
}

/**
 * Fetch the display name from a vault's binding documents, then user ontology.
 * Priority: id_document.data.name > self.data.name > user ontology displayName > fallback.
 *
 * @param gqlUrl     - GraphQL endpoint of the target vault server.
 * @param ownerEname - The eName of the vault owner (used as X-ENAME to scope the query
 *                     to their data — on a shared eVault server this is the key selector).
 * @param fallback   - Value to return when no name can be found.
 */
export async function fetchNameFromVault(
    gqlUrl: string,
    ownerEname: string,
    fallback: string,
    debug = false,
): Promise<string> {
    try {
        const data = await vaultGqlRequest<BindingDocsResult>(
            gqlUrl,
            ownerEname,
            BINDING_DOCS_QUERY,
        );
        const edges = data.bindingDocuments?.edges ?? [];
        if (debug) {
            console.debug("[fetchNameFromVault] binding docs fetched", {
                docsCount: edges.length,
                docs: edges.map((e) => ({
                    type: e.node.parsed?.type,
                    hasName: typeof e.node.parsed?.data?.name === "string",
                })),
            });
        }
        let selfName: string | null = null;
        for (const edge of edges) {
            const parsed = edge.node.parsed;
            if (!parsed) continue;
            if (
                parsed.type === "id_document" &&
                typeof parsed.data.name === "string"
            ) {
                return parsed.data.name;
            }
            if (
                parsed.type === "self" &&
                typeof parsed.data.name === "string"
            ) {
                selfName = parsed.data.name;
            }
        }
        if (selfName) return selfName;
    } catch {
        // non-critical — try user ontology next
    }

    try {
        const profileData = await vaultGqlRequest<UserProfileResult>(
            gqlUrl,
            ownerEname,
            USER_PROFILE_QUERY,
            { ontologyId: USER_ONTOLOGY_ID },
        );
        const profileNode = profileData.metaEnvelopes?.edges?.[0]?.node?.parsed;
        if (
            profileNode &&
            typeof profileNode.displayName === "string" &&
            profileNode.displayName
        ) {
            return profileNode.displayName;
        }
    } catch {
        // non-critical — fall through to fallback
    }

    return fallback;
}

// ---------------------------------------------------------------------------
// Social binding mutations
// ---------------------------------------------------------------------------

const CREATE_BINDING_DOC_MUTATION = `
    mutation CreateBindingDoc($input: CreateBindingDocumentInput!) {
        createBindingDocument(input: $input) {
            metaEnvelopeId
            bindingDocument {
                subject
                type
                signatures { signer signature timestamp }
            }
            errors { message code }
        }
    }
`;

const ADD_SIGNATURE_MUTATION = `
    mutation AddSignature($input: CreateBindingDocumentSignatureInput!) {
        createBindingDocumentSignature(input: $input) {
            bindingDocument {
                subject
                type
                signatures { signer signature timestamp }
            }
            errors { message code }
        }
    }
`;

const DELETE_META_ENVELOPE_MUTATION = `
    mutation DeleteMetaEnvelope($id: String!) {
        deleteMetaEnvelope(id: $id) {
            id
        }
    }
`;

const SOCIAL_BINDING_DOCS_QUERY = `
    query {
        bindingDocuments(first: 50) {
            edges {
                node {
                    id
                    parsed
                }
            }
        }
    }
`;

export interface CreateBindingDocResult {
    createBindingDocument: {
        metaEnvelopeId: string | null;
        bindingDocument: BindingDocParsed | null;
        errors: Array<{ message: string; code?: string }>;
    };
}

export interface AddSignatureResult {
    createBindingDocumentSignature: {
        bindingDocument: BindingDocParsed | null;
        errors: Array<{ message: string; code?: string }>;
    };
}

/**
 * Create a social_connection binding document on a target vault.
 *
 * @param targetGqlUrl    - GraphQL endpoint of the vault to write to.
 * @param vaultOwnerEname - eName of the vault owner (X-ENAME — determines which vault receives the doc).
 * @param signerEname     - eName of the party signing the document (ownerSignature.signer).
 * @param subject         - Subject of the binding document.
 * @param subjectName     - Name being asserted for the subject.
 * @param signatureHash   - Pre-computed hash of the canonical document.
 */
export async function createSocialConnectionDoc(
    targetGqlUrl: string,
    vaultOwnerEname: string,
    signerEname: string,
    subject: string,
    subjectName: string,
    signatureHash: string,
): Promise<string> {
    const normalizedSubject = subject.startsWith("@") ? subject : `@${subject}`;
    const normalizedSigner = signerEname.startsWith("@")
        ? signerEname
        : `@${signerEname}`;

    const result = await vaultGqlRequest<CreateBindingDocResult>(
        targetGqlUrl,
        vaultOwnerEname,
        CREATE_BINDING_DOC_MUTATION,
        {
            input: {
                subject: normalizedSubject,
                type: "social_connection",
                data: { kind: "social_connection", name: subjectName },
                ownerSignature: {
                    signer: normalizedSigner,
                    signature: signatureHash,
                    timestamp: new Date().toISOString(),
                },
            },
        },
    );

    if (result.createBindingDocument.errors?.length) {
        throw new Error(
            result.createBindingDocument.errors
                .map((e) => e.message)
                .join("; "),
        );
    }
    if (!result.createBindingDocument.metaEnvelopeId) {
        throw new Error("createBindingDocument returned no metaEnvelopeId");
    }
    return result.createBindingDocument.metaEnvelopeId;
}

/**
 * Add a counterparty signature to an existing binding document.
 *
 * @param vaultOwnerEname - eName of the vault being mutated (X-ENAME header).
 * @param signerEname     - eName of the party adding their signature.
 */
export async function addCounterpartySignature(
    targetGqlUrl: string,
    vaultOwnerEname: string,
    signerEname: string,
    bindingDocumentId: string,
    signatureHash: string,
): Promise<void> {
    const normalizedSigner = signerEname.startsWith("@")
        ? signerEname
        : `@${signerEname}`;

    const result = await vaultGqlRequest<AddSignatureResult>(
        targetGqlUrl,
        vaultOwnerEname,
        ADD_SIGNATURE_MUTATION,
        {
            input: {
                bindingDocumentId,
                signature: {
                    signer: normalizedSigner,
                    signature: signatureHash,
                    timestamp: new Date().toISOString(),
                },
            },
        },
    );

    if (result.createBindingDocumentSignature.errors?.length) {
        throw new Error(
            result.createBindingDocumentSignature.errors
                .map((e) => e.message)
                .join("; "),
        );
    }
}

/**
 * Delete a binding document (MetaEnvelope) from the caller's own vault.
 * Used when the requester declines a pending social binding request.
 */
export async function deleteSocialBindingDoc(
    gqlUrl: string,
    vaultOwnerEname: string,
    metaEnvelopeId: string,
): Promise<void> {
    await vaultGqlRequest(
        gqlUrl,
        vaultOwnerEname,
        DELETE_META_ENVELOPE_MUTATION,
        { id: metaEnvelopeId },
    );
}

/**
 * Poll the caller's own eVault for social_connection binding documents
 * that were created by someone else (i.e. the signer wrote a doc about themselves
 * into the requester's vault). Returns docs where subject !== callerEname and
 * the caller hasn't yet counter-signed.
 */
export async function fetchUnsignedSocialDocs(
    ownGqlUrl: string,
    callerEname: string,
): Promise<BindingDocEdge[]> {
    const normalized = callerEname.startsWith("@")
        ? callerEname
        : `@${callerEname}`;

    const data = await vaultGqlRequest<{
        bindingDocuments: { edges: BindingDocEdge[] };
    }>(ownGqlUrl, callerEname, SOCIAL_BINDING_DOCS_QUERY);

    return (data.bindingDocuments?.edges ?? []).filter((edge) => {
        const parsed = edge.node.parsed;
        if (!parsed || parsed.type !== "social_connection") return false;
        // The signer writes subject=@requester into the requester's vault,
        // so the requester IS the subject of the doc they need to counter-sign.
        if (parsed.subject !== normalized) return false;
        // Requester hasn't counter-signed yet
        const signatures = Array.isArray(parsed.signatures)
            ? parsed.signatures
            : [];
        const alreadySigned = signatures.some((s) => s.signer === normalized);
        return !alreadySigned;
    });
}

/**
 * Fetch an unsigned social_connection doc from a foreign vault where
 * subject === targetSubject and the caller hasn't yet signed.
 * Used by the requester to find the doc in the signer's vault
 * (subject=@requester, owner=@signer, missing @requester counter-sig).
 *
 * @param vaultOwnerEname - eName of the vault owner (used as X-ENAME to scope the query).
 * @param callerEname     - eName of the party checking for their own signature absence.
 */
export async function fetchUnsignedSocialDocForSubject(
    foreignGqlUrl: string,
    vaultOwnerEname: string,
    callerEname: string,
    targetSubject: string,
): Promise<BindingDocEdge | null> {
    const normalizedCaller = callerEname.startsWith("@")
        ? callerEname
        : `@${callerEname}`;
    const normalizedSubject = targetSubject.startsWith("@")
        ? targetSubject
        : `@${targetSubject}`;

    const data = await vaultGqlRequest<{
        bindingDocuments: { edges: BindingDocEdge[] };
    }>(foreignGqlUrl, vaultOwnerEname, SOCIAL_BINDING_DOCS_QUERY);

    const match = (data.bindingDocuments?.edges ?? []).find((edge) => {
        const parsed = edge.node.parsed;
        if (!parsed || parsed.type !== "social_connection") return false;
        if (parsed.subject !== normalizedSubject) return false;
        const signatures = Array.isArray(parsed.signatures)
            ? parsed.signatures
            : [];
        const alreadySigned = signatures.some(
            (s) => s.signer === normalizedCaller,
        );
        return !alreadySigned;
    });

    return match ?? null;
}
