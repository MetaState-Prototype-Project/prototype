import {
    type BindingDocParsed,
    fetchUnsignedSocialDocs,
} from "./socialBinding";

/**
 * Requests the user closed without answering, for this app session. Shared
 * because the home screen and the ePassport sheet both prompt for the same
 * documents, so closing one must not leave the other still asking.
 */
const dismissedDocIds = new Set<string>();

export function dismissSocialRequest(docId: string): void {
    dismissedDocIds.add(docId);
}

export function dismissedSocialRequests(): ReadonlySet<string> {
    return dismissedDocIds;
}

export interface PendingSocialRequest {
    docId: string;
    parsed: BindingDocParsed;
    signerEname: string;
}

/**
 * The pending social connection request to prompt for next, or null.
 *
 * Oldest first, so a backlog is worked through in the order it arrived.
 * `dismissedDocIds` holds the requests the user closed without answering;
 * they stay in the vault and in the bindings list, they just don't prompt
 * again. Envelopes fetchUnsignedSocialDocs hides stay hidden.
 */
export async function findPendingSocialRequest(
    ownGqlUrl: string,
    callerEname: string,
    dismissedDocIds: ReadonlySet<string> = new Set<string>(),
): Promise<PendingSocialRequest | null> {
    const edges = await fetchUnsignedSocialDocs(ownGqlUrl, callerEname);

    let oldest: PendingSocialRequest | null = null;
    let oldestSentAt = "";

    for (const edge of edges) {
        if (dismissedDocIds.has(edge.node.id)) continue;
        const parsed = edge.node.parsed;
        const signature = parsed?.signatures?.[0];
        if (!parsed || !signature?.signer) continue;
        const sentAt = signature.timestamp ?? "";
        if (oldest !== null && sentAt >= oldestSentAt) continue;
        oldest = {
            docId: edge.node.id,
            parsed,
            signerEname: signature.signer,
        };
        oldestSentAt = sentAt;
    }

    return oldest;
}
