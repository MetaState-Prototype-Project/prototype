/**
 * Ontology ids the PPA touches, and the shape it writes.
 *
 * Platform profiles are not their own ontology: a platform writes its
 * PlatformProfile under the User ontology and tags it with `platformName`.
 * That marker is what separates a platform record from an ordinary user
 * profile — see docs/docs/Post Platform Guide/platform-evault-registration.md.
 */

/** User profile — also carries PlatformProfile records, tagged by platformName. */
export const USER_ONTOLOGY = "550e8400-e29b-41d4-a716-446655440000";

/** PlatformAccreditation — the PPA's own decisions. */
export const PLATFORM_ACCREDITATION_ONTOLOGY =
    "e1749947-5a10-4973-b9fa-230d8714c36a";

export { ACCESS_LEVELS, isAccessLevel } from "$lib/levels";
export type { Domain } from "$lib/types";
export type { AccessLevel } from "$lib/levels";

/** A platform's submission for review, as read out of AaaS. */
export interface Submission {
    /** The platform eVault's eName — the stable key for a submission. */
    ename: string;
    platformName: string;
    displayName: string;
    description: string;
    category: string;
    version: string;
    url: string;
    logoUrl: string | null;
    authorEnames: string[];
    /** Ontology ids the platform declares it works with. */
    requestedOntologies: string[];
    /**
     * Domains the platform is asking for, derived from the ontologies it
     * declares. A decision can approve these or a subset — never more.
     */
    requestedDomains: string[];
    submissionEnvelopeId: string;
    submittedAt: string;
    /** The untouched PlatformProfile payload, shown behind a disclosure. */
    raw: Record<string, unknown>;
}

/** A decision the PPA has issued, as read back out of its own eVault. */
export interface Accreditation {
    accreditationId: string;
    platformEName: string;
    platformName: string;
    platformVersion: string;
    decision: "granted" | "denied";
    level: string | null;
    domains: string[];
    statement: string;
    reviewedByEName: string;
    issuerJwksUri: string;
    submissionEnvelopeId: string;
    /** The decision this one replaces for the same version, if any. */
    supersedes: string | null;
    jws: string;
    createdAt: string;
}

/**
 * A deep link a platform publishes about itself, as Meshenger does: an
 * ontology it can open, and a URL template with {ontology} and {w3id} holes.
 * Using what a platform declares is the only way to link into it that stays
 * correct when it changes its routes.
 */
export interface PlatformHandle {
    label: string;
    ontology: string;
    openUrl: string;
    can: string[];
    note: string | null;
}

/** A messenger platform discovered on the network, with what it can open. */
export interface Messenger {
    displayName: string;
    url: string | null;
    handles: PlatformHandle[];
}

/** A person behind a submission, resolved from their own eVault profile. */
export interface AuthorProfile {
    ename: string;
    displayName: string;
    handle: string | null;
    avatarUrl: string | null;
    bio: string | null;
    /** Deep link into the discovered messenger, or null when it can't open one. */
    messageUrl: string | null;
    /** The label the messenger gave that link, e.g. "Chat". */
    messageLabel: string | null;
}
