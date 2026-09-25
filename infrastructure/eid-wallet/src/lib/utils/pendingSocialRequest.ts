import {
    type BindingDocParsed,
    fetchUnsignedSocialDocs,
} from "./socialBinding";

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
