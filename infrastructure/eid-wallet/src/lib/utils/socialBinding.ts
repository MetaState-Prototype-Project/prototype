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
import { getCanonicalBindingDocString } from "./bindingDocHash";

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

// deleteMetaEnvelope returns Boolean! (a scalar) — selecting a subfield on it
// is a GraphQL validation error, which made every delete throw and silently
// no-op (e.g. a declined request never got removed and re-surfaced on the next
// poll). Request the scalar directly, with no selection set.
const DELETE_META_ENVELOPE_MUTATION = `
    mutation DeleteMetaEnvelope($id: String!) {
        deleteMetaEnvelope(id: $id)
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

function relationOf(parsed: BindingDocParsed): string {
    return typeof parsed.data?.relation_description === "string"
        ? parsed.data.relation_description
        : "";
}

/** Cutoffs are per (signer, relation description) — see collectAcceptanceCutoffs. */
function cutoffKey(signer: string, relationDescription: string): string {
    return `${signer}\u0000${relationDescription}`;
}

/**
 * For each invite the caller has ALREADY accepted, the timestamp of their
 * counter-signature. A completed binding is a doc subject=@caller that the
 * caller has counter-signed; its originator is signatures[0].signer.
 *
 * The timestamp is the cutoff that separates the two kinds of unsigned envelope
 * an accepted invite leaves behind: one created *before* the caller accepted is
 * a leftover from the same burst of repeat scans and must not re-surface as a
 * fresh request; one created *after* is a deliberate new invite and must be kept.
 *
 * Keyed by relation description as well as signer, because the same person can
 * send several invites before the caller acts on any of them. Keying on the
 * signer alone made accepting one of those wipe the rest, whatever their
 * description — which is the situation issue #1146 reports.
 */
function collectAcceptanceCutoffs(
    edges: BindingDocEdge[],
    normalizedCaller: string,
): Map<string, string> {
    const cutoffs = new Map<string, string>();
    for (const edge of edges) {
        const parsed = edge.node.parsed;
        if (!parsed || parsed.type !== "social_connection") continue;
        if (parsed.subject !== normalizedCaller) continue;
        const sigs = Array.isArray(parsed.signatures) ? parsed.signatures : [];
        const callerSig = sigs.find((s) => s.signer === normalizedCaller);
        const originator = sigs[0]?.signer;
        if (!callerSig || !originator || originator === normalizedCaller)
            continue;
        const key = cutoffKey(originator, relationOf(parsed));
        const acceptedAt = callerSig.timestamp ?? "";
        const previous = cutoffs.get(key);
        if (previous === undefined || acceptedAt > previous) {
            cutoffs.set(key, acceptedAt);
        }
    }
    return cutoffs;
}

/**
 * True when an unsigned envelope predates the caller's acceptance of the same
 * invite from the same person — see collectAcceptanceCutoffs.
 */
function isStaleLeftover(
    parsed: BindingDocParsed,
    cutoffs: Map<string, string>,
): boolean {
    const sigs = Array.isArray(parsed.signatures) ? parsed.signatures : [];
    const originator = sigs[0]?.signer;
    if (!originator) return false;
    const acceptedAt = cutoffs.get(cutoffKey(originator, relationOf(parsed)));
    if (acceptedAt === undefined) return false;
    return (sigs[0]?.timestamp ?? "") <= acceptedAt;
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

    const edges = data.bindingDocuments?.edges ?? [];
    const cutoffs = collectAcceptanceCutoffs(edges, normalized);

    const unsigned = edges.filter((edge) => {
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
        if (alreadySigned) return false;
        // Skip leftover envelopes from a signer the caller is already bound to.
        if (isStaleLeftover(parsed, cutoffs)) return false;
        return true;
    });

    // One request at a time per signer: each scan of the requester's QR creates
    // a fresh envelope, and a scanner who scans twice (thinking it didn't work)
    // leaves several. Surface the newest; accepting or declining it clears its
    // duplicates, and any genuinely different invite from the same person comes
    // up on the next poll.
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
 * After acting on one pending binding doc, look up every OTHER unsigned doc from
 * the same signer carrying the same relation description and delete them. Those
 * are the envelopes a repeat scan of the same QR leaves behind; collapsing them
 * stops the drawer re-prompting the user to accept the "same" binding over and
 * over.
 *
 * The relation description is what keeps this from eating deliberate second
 * invites: the same person can bind twice with different descriptions, and
 * acting on one of those must leave the other standing.
 */
export async function pruneDuplicateUnsignedDocs(
    ownGqlUrl: string,
    callerEname: string,
    keepDocId: string,
    signer: string,
    relationDescription: string,
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
        const description =
            typeof parsed.data?.relation_description === "string"
                ? parsed.data.relation_description
                : "";
        if (description !== relationDescription) return false;
        const sigs = Array.isArray(parsed.signatures) ? parsed.signatures : [];
        // Same signer, and the caller hasn't already countersigned this
        // one either — i.e. it's a stale duplicate of the doc we just
        // acted on.
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

/**
 * Delete leftover unsigned social_connection envelopes addressed to the caller
 * from signers the caller is ALREADY bound to. These pile up from repeat scans
 * of the caller's QR around the time of the original binding and would otherwise
 * re-surface as duplicate "Social Connection Request" prompts for a contact
 * already added.
 *
 * Only envelopes that predate the caller's acceptance are removed; a newer one
 * is a deliberate new invite from that contact and is left alone. The
 * fully-signed doc is never touched.
 *
 * Intended as a one-time cleanup when the invite drawer opens. Returns the
 * number of envelopes deleted.
 */
export async function pruneBoundSignerDocs(
    ownGqlUrl: string,
    callerEname: string,
): Promise<number> {
    const normalized = callerEname.startsWith("@")
        ? callerEname
        : `@${callerEname}`;

    const data = await vaultGqlRequest<{
        bindingDocuments: { edges: BindingDocEdge[] };
    }>(ownGqlUrl, callerEname, SOCIAL_BINDING_DOCS_QUERY);

    const edges = data.bindingDocuments?.edges ?? [];
    const cutoffs = collectAcceptanceCutoffs(edges, normalized);

    const stale = edges.filter((edge) => {
        const parsed = edge.node.parsed;
        if (!parsed || parsed.type !== "social_connection") return false;
        if (parsed.subject !== normalized) return false;
        const sigs = Array.isArray(parsed.signatures) ? parsed.signatures : [];
        // Keep the completed binding itself — only leftovers are stale.
        if (sigs.some((s) => s.signer === normalized)) return false;
        return isStaleLeftover(parsed, cutoffs);
    });

    let deleted = 0;
    for (const edge of stale) {
        try {
            await deleteSocialBindingDoc(ownGqlUrl, callerEname, edge.node.id);
            deleted += 1;
        } catch (err) {
            console.warn(
                "[socialBinding] failed to prune bound-signer doc",
                edge.node.id,
                err,
            );
        }
    }
    return deleted;
}

// ---------------------------------------------------------------------------
// Acting on a pending request
// ---------------------------------------------------------------------------

/**
 * Counter-sign a pending social binding request on the caller's own vault, then
 * drop the duplicate envelopes left by repeat scans of the same QR.
 *
 * Shared by every entry point that can accept a request (the invite drawer's
 * poll and the bindings list), so they can't drift apart.
 *
 * @param sign - signs the doc's canonical form; supplied by the caller so this
 *               module stays free of any GlobalState dependency.
 */
export async function acceptSocialBinding(
    ownGqlUrl: string,
    callerEname: string,
    docId: string,
    parsed: BindingDocParsed,
    sign: (payload: string) => Promise<string>,
): Promise<void> {
    const normalized = callerEname.startsWith("@")
        ? callerEname
        : `@${callerEname}`;

    const signatures = Array.isArray(parsed.signatures)
        ? parsed.signatures
        : [];

    // Idempotency: if the doc already carries our signature (a stale poll result
    // re-surfaced after we just signed it), treat as already-done.
    if (!signatures.some((s) => s.signer === normalized)) {
        const canonical = getCanonicalBindingDocString({
            subject: parsed.subject,
            type: parsed.type,
            data: parsed.data,
        });
        const signature = await sign(canonical);
        await addCounterpartySignature(
            ownGqlUrl,
            normalized,
            normalized,
            docId,
            signature,
        );
    }

    await pruneDuplicatesOf(ownGqlUrl, normalized, docId, parsed);
}

/** Shared tail of accept and decline — see pruneDuplicateUnsignedDocs. */
async function pruneDuplicatesOf(
    ownGqlUrl: string,
    normalizedCaller: string,
    docId: string,
    parsed: BindingDocParsed,
): Promise<void> {
    const signer = parsed.signatures?.[0]?.signer;
    if (!signer) return;
    try {
        await pruneDuplicateUnsignedDocs(
            ownGqlUrl,
            normalizedCaller,
            docId,
            signer,
            typeof parsed.data?.relation_description === "string"
                ? parsed.data.relation_description
                : "",
        );
    } catch (err) {
        console.warn("[socialBinding] duplicate prune failed:", err);
    }
}

/**
 * Reject a pending social binding request: delete the envelope, then the
 * duplicates queued behind it. Without that second step the next refresh
 * re-prompts with what looks like the request the user just declined (#1082).
 */
export async function declineSocialBinding(
    ownGqlUrl: string,
    callerEname: string,
    docId: string,
    parsed: BindingDocParsed | null,
): Promise<void> {
    const normalized = callerEname.startsWith("@")
        ? callerEname
        : `@${callerEname}`;

    await deleteSocialBindingDoc(ownGqlUrl, normalized, docId);

    // docId is already gone, so nothing is actually kept — the prune clears
    // whatever duplicates of it remain.
    if (parsed) await pruneDuplicatesOf(ownGqlUrl, normalized, docId, parsed);
}

/**
 * The one refusal cancelSentSocialBinding surfaces to the user, as a code rather
 * than a sentence: this module has no i18n, so the caller renders the wording.
 */
export const CANCEL_NOT_PENDING = "social-binding/cancel-not-pending";

/**
 * Withdraw an invite the caller sent by scanning: delete the pending doc from
 * the counterparty's vault first, then the caller's local mirror.
 *
 * Remote first, and only on success — if the delete over there fails, the
 * counterparty can still accept, and dropping the mirror would leave the caller
 * blind to a binding that then completes.
 *
 * Throws if the counterparty has already counter-signed; a completed binding is
 * not something to withdraw silently.
 */
export async function cancelSentSocialBinding(
    ownGqlUrl: string,
    callerEname: string,
    mirrorDocId: string,
    counterpartyEname: string,
    relationDescription: string,
): Promise<void> {
    const normalized = callerEname.startsWith("@")
        ? callerEname
        : `@${callerEname}`;
    const normalizedCounter = counterpartyEname.startsWith("@")
        ? counterpartyEname
        : `@${counterpartyEname}`;

    const remote = await fetchRemoteDocsWithSelf(normalized, normalizedCounter);
    const matching = remote.docs.filter(
        (d) => d.relationDescription === relationDescription,
    );
    const pending = matching.filter((d) => d.signatureCount < 2);

    if (pending.length === 0) {
        if (matching.length > 0) {
            // Some doc with this description is on their side but none of them
            // is pending. Either they counter-signed this invite or they
            // declined it and an older binding with the same description (very
            // often the empty one) is what we are seeing. The description is
            // all we have to match on, so don't guess which: leave the mirror
            // alone and let the reconcile settle it on the next read.
            throw new Error(CANCEL_NOT_PENDING);
        }
        // Nothing with this description on their side at all: they declined and
        // deleted it, so only the orphaned mirror is left.
    } else {
        // One mirror, one invite: drop the newest match, the one this mirror
        // most plausibly created.
        const newest = pending.reduce((a, b) =>
            b.timestamp > a.timestamp ? b : a,
        );
        await deleteSocialBindingDoc(
            remote.gqlUrl,
            normalizedCounter,
            newest.id,
        );
    }

    await deleteSocialBindingDoc(ownGqlUrl, normalized, mirrorDocId);
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
    /**
     * The doc as stored. Kept so a pending request can be counter-signed from
     * the list without re-fetching — signing needs subject/type/data to rebuild
     * the canonical form.
     */
    parsed: BindingDocParsed;
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
            parsed,
        });
    }

    out.sort((a, b) => b.completedAt.localeCompare(a.completedAt));
    return out;
}

// ---------------------------------------------------------------------------
// Reconciling scanner-side ("sent") mirrors against the source of truth
// ---------------------------------------------------------------------------

/**
 * True status of a scanner-initiated ("sent") binding, determined by reading the
 * primary doc in the counterparty's vault — the source of truth. The scanner
 * only holds a single-signature mirror; the real doc lives over there.
 *
 * - `confirmed`: the counterparty counter-signed (doc has 2 signatures).
 * - `pending`:   the counterparty hasn't acted yet (doc has 1 signature).
 * - `declined`:  the counterparty declined and deleted the doc (it's gone).
 */
export type SentBindingStatus = "confirmed" | "pending" | "declined";

/** One social_connection doc in a counterparty's vault that involves the caller. */
interface RemoteSocialDoc {
    id: string;
    relationDescription: string;
    signatureCount: number;
    /** Originator's signature timestamp — when the invite was sent. */
    timestamp: string;
}

/**
 * Every social_connection doc the caller created in the counterparty's vault,
 * walked across all pages. Reuses the same cross-vault read path as
 * fetchNameFromVault (X-ENAME scopes the query to the counterparty's data).
 *
 * The originator check matters: the counterparty's own mirrors (from them
 * scanning the caller) also carry subject=@them and both parties, and counting
 * those as invites the caller sent would leave a declined invite looking pending
 * forever.
 *
 * Throws if the counterparty vault can't be resolved or reached — callers MUST
 * treat a throw as "unknown" and leave local mirrors untouched, so a transient
 * network error never deletes a still-valid binding.
 */
async function fetchRemoteDocsWithSelf(
    normalizedSelf: string,
    normalizedCounter: string,
): Promise<{ gqlUrl: string; docs: RemoteSocialDoc[] }> {
    const gqlUrl = await resolveVaultUri(normalizedCounter);

    const docs: RemoteSocialDoc[] = [];
    let after: string | null = null;
    do {
        const data: SocialBindingDocsPage =
            await vaultGqlRequest<SocialBindingDocsPage>(
                gqlUrl,
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

            const sigs = Array.isArray(parsed.signatures)
                ? parsed.signatures
                : [];
            if (sigs[0]?.signer !== normalizedSelf) continue;

            docs.push({
                id: edge.node.id,
                relationDescription:
                    typeof parsed.data?.relation_description === "string"
                        ? (parsed.data.relation_description as string)
                        : "",
                signatureCount: sigs.length,
                timestamp: sigs[0]?.timestamp ?? "",
            });
        }

        const pageInfo = connection?.pageInfo;
        after = pageInfo?.hasNextPage ? (pageInfo?.endCursor ?? null) : null;
    } while (after !== null);

    return { gqlUrl, docs };
}

/**
 * Resolve the status of every pending mirror the caller holds for one
 * counterparty, from a single read of that counterparty's vault.
 *
 * The mirror carries no pointer to the doc it created over there, so the two
 * sides are matched on relation_description — the only field that distinguishes
 * one invite to the same person from another. Within a description, confirmed
 * docs claim the oldest mirrors and pending docs the next; a mirror left with
 * nothing to claim is one the counterparty declined and deleted.
 *
 * Matching on parties alone (what this used to do) marked every pending mirror
 * confirmed as soon as *any* binding with that person was — so a second invite
 * showed as accepted the moment it was sent.
 */
function resolveSentStatuses(
    mirrors: SocialBindingSummary[],
    remote: RemoteSocialDoc[],
): Map<string, SentBindingStatus> {
    const pools = new Map<string, { confirmed: number; pending: number }>();
    for (const doc of remote) {
        const pool = pools.get(doc.relationDescription) ?? {
            confirmed: 0,
            pending: 0,
        };
        if (doc.signatureCount >= 2) pool.confirmed += 1;
        else pool.pending += 1;
        pools.set(doc.relationDescription, pool);
    }

    const byDescription = new Map<string, SocialBindingSummary[]>();
    for (const mirror of mirrors) {
        const group = byDescription.get(mirror.relationDescription);
        if (group) group.push(mirror);
        else byDescription.set(mirror.relationDescription, [mirror]);
    }

    const statuses = new Map<string, SentBindingStatus>();
    for (const [description, group] of byDescription) {
        const pool = pools.get(description) ?? { confirmed: 0, pending: 0 };
        // Oldest first, so a confirmation lands on the invite that has been
        // waiting longest rather than on whichever one sorted first.
        const ordered = [...group].sort((a, b) =>
            a.completedAt.localeCompare(b.completedAt),
        );
        for (const mirror of ordered) {
            if (pool.confirmed > 0) {
                pool.confirmed -= 1;
                statuses.set(mirror.docId, "confirmed");
            } else if (pool.pending > 0) {
                pool.pending -= 1;
                statuses.set(mirror.docId, "pending");
            } else {
                statuses.set(mirror.docId, "declined");
            }
        }
    }
    return statuses;
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
 * A confirmed or already-mutually-signed binding needs no remote read, and each
 * counterparty is read once however many mirrors point at them.
 */
export async function fetchReconciledSocialBindings(
    ownGqlUrl: string,
    callerEname: string,
): Promise<SocialBindingSummary[]> {
    const summaries = await fetchSocialBindings(ownGqlUrl, callerEname);
    const normalized = callerEname.startsWith("@")
        ? callerEname
        : `@${callerEname}`;

    const byCounterparty = new Map<string, SocialBindingSummary[]>();
    for (const summary of summaries) {
        // Only scanner-initiated mirrors that aren't yet mutually signed need a
        // remote check; everything else is already authoritative.
        if (summary.role !== "sent" || summary.mutuallySigned) continue;
        const group = byCounterparty.get(summary.counterpartyEname);
        if (group) group.push(summary);
        else byCounterparty.set(summary.counterpartyEname, [summary]);
    }
    if (byCounterparty.size === 0) return summaries;

    const statuses = new Map<string, SentBindingStatus>();
    await Promise.all(
        Array.from(byCounterparty, async ([counterparty, mirrors]) => {
            try {
                const remote = await fetchRemoteDocsWithSelf(
                    normalized,
                    counterparty.startsWith("@")
                        ? counterparty
                        : `@${counterparty}`,
                );
                for (const [docId, status] of resolveSentStatuses(
                    mirrors,
                    remote.docs,
                )) {
                    statuses.set(docId, status);
                }
            } catch (err) {
                // Couldn't reach the counterparty vault — leave these mirrors
                // unresolved and keep them; never delete on a transient failure.
                console.warn(
                    "[socialBinding] could not reconcile sent bindings with",
                    counterparty,
                    err,
                );
            }
        }),
    );

    const out: SocialBindingSummary[] = [];
    for (const summary of summaries) {
        const status = statuses.get(summary.docId);
        if (status === "confirmed") {
            out.push({ ...summary, mutuallySigned: true });
        } else if (status === "declined") {
            // The counterparty rejected the request and deleted their copy —
            // remove our orphaned mirror so it stops showing as a successful
            // binding, then drop it from this list.
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
        } else {
            out.push(summary);
        }
    }
    return out;
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
