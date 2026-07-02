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

// Typed variant — fetches only the two doc types that carry a display name,
// so photo blobs from the counterparty vault never travel over the network.
// Used when the caller only needs a name and nothing else.
const BINDING_DOCS_BY_TYPE_QUERY = `
    query($type: BindingDocumentType!) {
        bindingDocuments(type: $type, first: 10) {
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
    { nameOnly = false }: { nameOnly?: boolean } = {},
): Promise<string> {
    try {
        let edges: BindingDocEdge[];
        if (nameOnly) {
            // Only fetch the two types that carry a display name — avoids
            // downloading photo blobs from the counterparty vault.
            const [idDocData, selfData] = await Promise.all([
                vaultGqlRequest<BindingDocsResult>(
                    gqlUrl,
                    ownerEname,
                    BINDING_DOCS_BY_TYPE_QUERY,
                    { type: "id_document" },
                ),
                vaultGqlRequest<BindingDocsResult>(
                    gqlUrl,
                    ownerEname,
                    BINDING_DOCS_BY_TYPE_QUERY,
                    { type: "self" },
                ),
            ]);
            edges = [
                ...(idDocData.bindingDocuments?.edges ?? []),
                ...(selfData.bindingDocuments?.edges ?? []),
            ];
        } else {
            const data = await vaultGqlRequest<BindingDocsResult>(
                gqlUrl,
                ownerEname,
                BINDING_DOCS_QUERY,
            );
            edges = data.bindingDocuments?.edges ?? [];
        }
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
        bindingDocuments(type: social_connection, first: 50) {
            edges {
                node {
                    id
                    parsed
                }
            }
        }
    }
`;

// Paginated variant for fetchSentBindingStatus, which must walk every page
// before concluding a doc is gone (see there).
const SOCIAL_BINDING_DOCS_PAGE_QUERY = `
    query($after: String) {
        bindingDocuments(type: social_connection, first: 100, after: $after) {
            edges {
                node {
                    id
                    parsed
                }
            }
            pageInfo {
                hasNextPage
                endCursor
            }
        }
    }
`;

// Named so fetchSentBindingStatus can annotate `data` and avoid a circular
// inference error (TS7022) from reassigning the cursor inside the paging loop.
interface SocialBindingDocsPage {
    bindingDocuments: {
        edges: BindingDocEdge[];
        pageInfo: { hasNextPage: boolean; endCursor: string | null };
    };
}

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
    parties: [string, string],
    relationDescription: string,
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
                data: {
                    kind: "social_connection",
                    name: subjectName,
                    parties: parties.map((p) =>
                        p.startsWith("@") ? p : `@${p}`,
                    ) as [string, string],
                    relation_description: relationDescription,
                },
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

    const unsigned = (data.bindingDocuments?.edges ?? []).filter((edge) => {
        const parsed = edge.node.parsed;
        if (!parsed || parsed.type !== "social_connection") return false;
        // The signer writes subject=@requester into the requester's vault,
        // so the requester IS the subject of the doc they need to counter-sign.
        if (parsed.subject !== normalized) return false;
        // Requester hasn't counter-signed yet.
        const signatures = Array.isArray(parsed.signatures)
            ? parsed.signatures
            : [];
        const alreadySigned = signatures.some((s) => s.signer === normalized);
        return !alreadySigned;
    });

    // Dedupe by signer: each scan of the requester's QR creates a fresh
    // envelope. When a scanner scans more than once (the usual reason —
    // they thought it didn't work) the requester ends up with several
    // identical pending docs, all needing acceptance. Surface just the
    // newest from each signer; the dupes are pruned by
    // pruneDuplicateUnsignedDocs() below at consent time.
    const newestBySigner = new Map<string, BindingDocEdge>();
    for (const edge of unsigned) {
        const signer = edge.node.parsed?.signatures?.[0]?.signer ?? null;
        if (!signer) continue;
        const existing = newestBySigner.get(signer);
        if (!existing) {
            newestBySigner.set(signer, edge);
            continue;
        }
        const existingTs =
            existing.node.parsed?.signatures?.[0]?.timestamp ?? "";
        const candidateTs = edge.node.parsed?.signatures?.[0]?.timestamp ?? "";
        if (candidateTs > existingTs) newestBySigner.set(signer, edge);
    }
    return Array.from(newestBySigner.values());
}

/**
 * After successfully counter-signing one pending binding doc from a given
 * signer, look up every OTHER unsigned doc with the same signer on the
 * caller's vault and delete them. These are duplicate envelopes from
 * repeat scans of the same QR; collapsing them here stops the drawer from
 * re-prompting the user to accept the "same" binding over and over.
 */
export async function pruneDuplicateUnsignedDocs(
    ownGqlUrl: string,
    callerEname: string,
    keepDocId: string,
    signer: string,
): Promise<number> {
    const normalized = callerEname.startsWith("@")
        ? callerEname
        : `@${callerEname}`;

    const data = await vaultGqlRequest<{
        bindingDocuments: { edges: BindingDocEdge[] };
    }>(ownGqlUrl, callerEname, SOCIAL_BINDING_DOCS_QUERY);

    const dupes = (data.bindingDocuments?.edges ?? []).filter((edge) => {
        if (edge.node.id === keepDocId) return false;
        const parsed = edge.node.parsed;
        if (!parsed || parsed.type !== "social_connection") return false;
        if (parsed.subject !== normalized) return false;
        const sigs = Array.isArray(parsed.signatures) ? parsed.signatures : [];
        // Same signer, and the caller hasn't already countersigned this
        // one either — i.e. it's a stale duplicate of the doc we just
        // accepted.
        const sameSigner = sigs[0]?.signer === signer;
        const callerAlreadySigned = sigs.some((s) => s.signer === normalized);
        return sameSigner && !callerAlreadySigned;
    });

    let deleted = 0;
    for (const edge of dupes) {
        try {
            await deleteSocialBindingDoc(ownGqlUrl, callerEname, edge.node.id);
            deleted += 1;
        } catch (err) {
            console.warn(
                "[socialBinding] failed to prune duplicate doc",
                edge.node.id,
                err,
            );
        }
    }
    return deleted;
}

// ---------------------------------------------------------------------------
// Listing completed social bindings
// ---------------------------------------------------------------------------

export interface SocialBindingSummary {
    docId: string;
    counterpartyEname: string;
    /** ISO timestamp of the most recent signature on the doc. */
    completedAt: string;
    relationDescription: string;
    /** False for scanner-side mirror copies that only carry one signature. */
    mutuallySigned: boolean;
    /**
     * `sent` — the user initiated this binding (signed first).
     * `received` — the user countersigned a request from the counterparty.
     * Derived from `signatures[0].signer`. Defaults to `received` when there
     * are no signatures (shouldn't happen post-fetch but stay defensive).
     */
    role: "sent" | "received";
}

// All social_connection docs on the caller's own vault, newest first.
// Includes scanner-side mirrors (single sig) alongside fully-bound docs.
export async function fetchSocialBindings(
    ownGqlUrl: string,
    callerEname: string,
): Promise<SocialBindingSummary[]> {
    const normalized = callerEname.startsWith("@")
        ? callerEname
        : `@${callerEname}`;

    const data = await vaultGqlRequest<{
        bindingDocuments: { edges: BindingDocEdge[] };
    }>(ownGqlUrl, callerEname, SOCIAL_BINDING_DOCS_QUERY);

    const out: SocialBindingSummary[] = [];
    for (const edge of data.bindingDocuments?.edges ?? []) {
        const parsed = edge.node.parsed;
        if (!parsed || parsed.type !== "social_connection") continue;

        const parties = Array.isArray(parsed.data?.parties)
            ? (parsed.data.parties as string[])
            : [];
        const counterparty = parties.find((p) => p !== normalized);
        if (!counterparty) continue;

        const sigs = Array.isArray(parsed.signatures) ? parsed.signatures : [];
        if (sigs.length === 0) continue;

        const completedAt = sigs
            .map((s) => s.timestamp)
            .sort()
            .reverse()[0];

        const firstSigner = sigs[0]?.signer;
        const role: "sent" | "received" =
            firstSigner === normalized ? "sent" : "received";

        out.push({
            docId: edge.node.id,
            counterpartyEname: counterparty,
            completedAt,
            relationDescription:
                typeof parsed.data?.relation_description === "string"
                    ? (parsed.data.relation_description as string)
                    : "",
            mutuallySigned: sigs.length >= 2,
            role,
        });
    }

    out.sort((a, b) => b.completedAt.localeCompare(a.completedAt));
    return out;
}

// ---------------------------------------------------------------------------
// Reconciling scanner-side ("sent") mirrors against the source of truth
// ---------------------------------------------------------------------------

/**
 * True status of a scanner-initiated ("sent") binding, determined by reading
 * the primary doc in the counterparty's vault — the source of truth. The
 * scanner only holds a single-signature mirror; the real doc lives in the
 * counterparty's vault.
 *
 * - `confirmed`: the counterparty counter-signed (doc has 2 signatures).
 * - `pending`:   the counterparty hasn't acted yet (doc has 1 signature).
 * - `declined`:  the counterparty declined and deleted the doc (it's gone).
 */
export type SentBindingStatus = "confirmed" | "pending" | "declined";

/**
 * Read the counterparty's vault to determine the true status of a binding the
 * caller initiated by scanning. Reuses the same cross-vault read path as
 * fetchNameFromVault (X-ENAME scopes the query to the counterparty's data).
 *
 * Throws if the counterparty vault can't be resolved or reached — callers MUST
 * treat a throw as "unknown" and leave the local mirror untouched, so a
 * transient network error never deletes a still-valid binding.
 */
export async function fetchSentBindingStatus(
    selfEname: string,
    counterpartyEname: string,
): Promise<SentBindingStatus> {
    const normalizedSelf = selfEname.startsWith("@")
        ? selfEname
        : `@${selfEname}`;
    const normalizedCounter = counterpartyEname.startsWith("@")
        ? counterpartyEname
        : `@${counterpartyEname}`;

    const foreignGqlUrl = await resolveVaultUri(normalizedCounter);

    // The primary doc has subject=@counterparty and lists both parties; any
    // 2-signature match means confirmed (repeat scans can leave several). Only
    // conclude "declined" — which deletes the mirror — after all pages are checked.
    let after: string | null = null;
    let sawMatch = false;
    do {
        const data: SocialBindingDocsPage =
            await vaultGqlRequest<SocialBindingDocsPage>(
                foreignGqlUrl,
                normalizedCounter,
                SOCIAL_BINDING_DOCS_PAGE_QUERY,
                { after: after ?? undefined },
            );

        const connection = data.bindingDocuments;
        for (const edge of connection?.edges ?? []) {
            const parsed = edge.node.parsed;
            if (!parsed || parsed.type !== "social_connection") continue;
            if (parsed.subject !== normalizedCounter) continue;
            const parties = Array.isArray(parsed.data?.parties)
                ? (parsed.data.parties as string[])
                : [];
            if (!parties.includes(normalizedSelf)) continue;

            sawMatch = true;
            // A 2-signature match is terminal — the counterparty counter-signed.
            const sigs = parsed.signatures;
            if (Array.isArray(sigs) && sigs.length >= 2) return "confirmed";
        }

        const pageInfo = connection?.pageInfo;
        after = pageInfo?.hasNextPage ? (pageInfo?.endCursor ?? null) : null;
    } while (after !== null);

    // No matching doc on any page → the counterparty deleted it (declined).
    // Otherwise we only ever saw single-signature matches → still pending.
    return sawMatch ? "pending" : "declined";
}

/**
 * Fetch the caller's social bindings and reconcile every scanner-initiated
 * ("sent") mirror that isn't yet mutually signed against the counterparty's
 * vault (the source of truth):
 *
 * - counterparty counter-signed  → mark the mirror mutually signed.
 * - counterparty declined (gone) → drop it from the list AND delete the now
 *   orphaned local mirror, so a rejected binding stops showing as successful
 *   (the whole point of this reconcile — see issue #990).
 * - still pending / unreachable  → keep it as an unconfirmed (pending) binding.
 *
 * A confirmed or already-mutually-signed binding needs no remote read.
 */
export async function fetchReconciledSocialBindings(
    ownGqlUrl: string,
    callerEname: string,
): Promise<SocialBindingSummary[]> {
    const summaries = await fetchSocialBindings(ownGqlUrl, callerEname);

    const reconciled = await Promise.all(
        summaries.map(async (summary) => {
            // Only scanner-initiated mirrors that aren't yet mutually signed
            // need a remote check; everything else is already authoritative.
            if (summary.role !== "sent" || summary.mutuallySigned) {
                return summary;
            }
            try {
                const status = await fetchSentBindingStatus(
                    callerEname,
                    summary.counterpartyEname,
                );
                if (status === "confirmed") {
                    return { ...summary, mutuallySigned: true };
                }
                if (status === "declined") {
                    // The counterparty rejected the request and deleted their
                    // copy — remove our orphaned mirror so it stops showing as
                    // a successful binding, then drop it from this list.
                    void deleteSocialBindingDoc(
                        ownGqlUrl,
                        callerEname,
                        summary.docId,
                    ).catch((err) =>
                        console.warn(
                            "[socialBinding] failed to delete declined mirror",
                            summary.docId,
                            err,
                        ),
                    );
                    return null;
                }
                // pending — keep it as an unconfirmed binding.
                return summary;
            } catch (err) {
                // Couldn't reach the counterparty vault — treat as unknown and
                // keep the mirror; never delete on a transient failure.
                console.warn(
                    "[socialBinding] could not reconcile sent binding with",
                    summary.counterpartyEname,
                    err,
                );
                return summary;
            }
        }),
    );

    return reconciled.filter((s): s is SocialBindingSummary => s !== null);
}

// ---------------------------------------------------------------------------
// Scanner-side mirror write
// ---------------------------------------------------------------------------

// Self-signed mirror on the scanner's own vault so scanner-initiated bindings
// also show up in their list. Signature is over the mirror's canonical form
// (subject differs from the primary doc, so it can't be reused).
export async function createOwnSocialBindingMirror(
    ownGqlUrl: string,
    selfEname: string,
    counterpartyEname: string,
    counterpartyName: string,
    relationDescription: string,
    signatureHash: string,
): Promise<void> {
    const normalizedSelf = selfEname.startsWith("@")
        ? selfEname
        : `@${selfEname}`;
    const normalizedCounter = counterpartyEname.startsWith("@")
        ? counterpartyEname
        : `@${counterpartyEname}`;

    const result = await vaultGqlRequest<CreateBindingDocResult>(
        ownGqlUrl,
        selfEname,
        CREATE_BINDING_DOC_MUTATION,
        {
            input: {
                subject: normalizedSelf,
                type: "social_connection",
                data: {
                    kind: "social_connection",
                    name: counterpartyName,
                    parties: [normalizedSelf, normalizedCounter],
                    relation_description: relationDescription,
                },
                ownerSignature: {
                    signer: normalizedSelf,
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
        throw new Error(
            "createBindingDocument returned no metaEnvelopeId — missing envelope ID for social binding mirror",
        );
    }
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
