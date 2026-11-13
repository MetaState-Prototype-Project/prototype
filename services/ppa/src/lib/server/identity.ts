/**
 * Identity assurance for the people accountable for a release.
 *
 * The certification framework sets a minimum IAL per level and says a wholly
 * anonymous responsible party can never hold a certified release. It leaves
 * the calculation to "an external identity engine", but the evidence is
 * already in the ecosystem: an `id_document` binding document records a
 * verified eID, and a `social_connection` records one person attesting to
 * another, signed by both.
 *
 * So the level is derived rather than asked, reduced to the weakest actor, and
 * the reviewer may override it.
 */

import { type BindingDocument, fetchBindingDocuments } from "./evault";
import { type IdentityLevel, identityIndex } from "$lib/levels";

export interface ActorIdentity {
    ename: string;
    ial: IdentityLevel;
    idDocuments: number;
    attestations: number;
    /** Attesters who were themselves passport-verified. */
    verifiedAttesters: number;
    /** Set when the actor's documents could not be read at all. */
    error?: string;
}

function normalize(ename: string): string {
    const trimmed = ename.trim().toLowerCase();
    if (!trimmed) return "";
    return trimmed.startsWith("@") ? trimmed : `@${trimmed}`;
}

/** The other party to a social connection, or null if it is malformed. */
function counterparty(doc: BindingDocument, subject: string): string | null {
    const parties = doc.data.parties;
    if (Array.isArray(parties)) {
        for (const party of parties) {
            if (typeof party !== "string") continue;
            if (normalize(party) !== subject) return normalize(party);
        }
    }
    // Fall back to the signatures: a countersigned connection has two signers.
    for (const signature of doc.signatures) {
        if (typeof signature?.signer !== "string") continue;
        if (normalize(signature.signer) !== subject) {
            return normalize(signature.signer);
        }
    }
    return null;
}

/** A social connection only counts once both parties have signed it. */
function isCountersigned(doc: BindingDocument): boolean {
    const signers = new Set(
        doc.signatures
            .map((s) => (typeof s?.signer === "string" ? normalize(s.signer) : ""))
            .filter(Boolean),
    );
    return signers.size >= 2;
}

function hasIdDocument(docs: BindingDocument[]): boolean {
    return docs.some(
        (d) =>
            d.type === "id_document" &&
            typeof d.data.vendor === "string" &&
            typeof d.data.reference === "string" &&
            d.signatures.length > 0,
    );
}

/**
 * Identity assurance for one eName.
 *
 * Counterparties are resolved one level deep only, and memoised: deciding
 * whether an attester is themselves passport-verified needs their documents,
 * but going further would walk the whole social graph, and a mutual attestation
 * (A vouches for B, B vouches for A) would not terminate.
 */
export async function deriveIdentity(
    ename: string,
    cache = new Map<string, BindingDocument[]>(),
    resolveAttesters = true,
): Promise<ActorIdentity> {
    const subject = normalize(ename);
    const base: ActorIdentity = {
        ename: subject,
        ial: "IAL1",
        idDocuments: 0,
        attestations: 0,
        verifiedAttesters: 0,
    };

    let docs: BindingDocument[];
    try {
        docs = cache.get(subject) ?? (await fetchBindingDocuments(subject));
        cache.set(subject, docs);
    } catch (error) {
        // An unreadable vault is not evidence of identity, so it stays IAL1 —
        // but say so, rather than letting it look like a considered result.
        const reason = error instanceof Error ? error.message : String(error);
        console.warn(`[ppa/identity] could not read ${subject}: ${reason}`);
        return {
            ...base,
            error: reason,
        };
    }

    const idDocuments = docs.filter((d) => d.type === "id_document").length;
    const connections = docs.filter(
        (d) => d.type === "social_connection" && isCountersigned(d),
    );
    const passportVerified = hasIdDocument(docs);

    let verifiedAttesters = 0;
    if (resolveAttesters) {
        for (const doc of connections) {
            const other = counterparty(doc, subject);
            if (!other) continue;
            // One level deep: do not resolve the attester's own attesters.
            const attester = await deriveIdentity(other, cache, false);
            if (identityIndex(attester.ial) >= identityIndex("IAL3")) {
                verifiedAttesters++;
            }
        }
    }

    let ial: IdentityLevel = "IAL1";
    if (passportVerified && verifiedAttesters >= 3) ial = "IAL4";
    else if (passportVerified) ial = "IAL3";
    else if (connections.length > 0) ial = "IAL2";

    return {
        ...base,
        ial,
        idDocuments,
        attestations: connections.length,
        verifiedAttesters,
    };
}

/** The weakest actor decides what the release can be certified at. */
export function minimumIdentity(actors: ActorIdentity[]): IdentityLevel {
    if (actors.length === 0) return "IAL1";
    return actors.reduce<IdentityLevel>(
        (lowest, actor) =>
            identityIndex(actor.ial) < identityIndex(lowest) ? actor.ial : lowest,
        "IAL4",
    );
}

/** Every accountable person behind a release, de-duplicated, with their role. */
export function accountableActors(submission: {
    authorEnames: string[];
    submissionProof: { statement: { signerEName: string } };
}): { ename: string; role: string }[] {
    const seen = new Map<string, string>();
    const add = (ename: string, role: string) => {
        const key = normalize(ename);
        if (!key || seen.has(key)) return;
        seen.set(key, role);
    };
    add(submission.submissionProof.statement.signerEName, "releaseSigner");
    for (const author of submission.authorEnames) add(author, "author");
    return Array.from(seen, ([ename, role]) => ({ ename, role }));
}
