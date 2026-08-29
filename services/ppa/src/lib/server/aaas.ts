/**
 * Read side: everything the PPA knows about the outside world comes from
 * Awareness-as-a-Service.
 *
 * Platforms publish a PlatformProfile into their own eVault under the User
 * ontology, tagged with `platformName`. A platform applying for network access
 * additionally sets `inSubmission: true`. AaaS fans those writes out and
 * exposes them at GET /api/packets, which is what we page through here — the
 * same read path the marketplace uses (platforms/marketplace/client/server/aaas.ts).
 *
 * The AaaS API key is a secret, so this module is server-only.
 */

import {
    type Accreditation,
    type AuthorProfile,
    type Messenger,
    type PlatformHandle,
    PLATFORM_ACCREDITATION_ONTOLOGY,
    type Submission,
    USER_ONTOLOGY,
} from "./ontology";
import {
    awarenessApiKey,
    awarenessUrl,
    messengerContactPath,
    messengerPlatformName,
} from "./env";
import { ontologyDomains } from "./domains";

interface Packet {
    id: string;
    ontology: string;
    w3id: string | null;
    data: Record<string, any> | null;
    receivedAt: string;
}

interface PacketsResponse {
    packets: Packet[];
    hasMore: boolean;
    nextCursor: string | null;
}

/**
 * Whether this deployment can read the platform directory at all. Without a
 * key every query returns nothing, which must not be presented as "no
 * submissions" — an unconfigured app and an empty queue look identical
 * otherwise, and the reviewer has no way to tell.
 */
export function isReadConfigured(): boolean {
    return Boolean(awarenessApiKey());
}

function base(): string {
    return awarenessUrl().replace(/\/$/, "");
}

/** One page of packets for the given filters. */
async function page(
    params: Record<string, string | number>,
    cursor?: string | null,
): Promise<PacketsResponse> {
    const query = new URLSearchParams();
    query.set("limit", "500");
    for (const [k, v] of Object.entries(params)) query.set(k, String(v));
    if (cursor) query.set("cursor", cursor);

    const url = `${base()}/api/packets?${query.toString()}`;
    const res = await fetch(url, {
        headers: { Authorization: `Bearer ${awarenessApiKey()}` },
    });
    const body = await res.text();
    if (!res.ok) {
        console.error(
            `[ppa/aaas] ${res.status} ${res.statusText} from /api/packets: ${body.slice(0, 500)}`,
        );
        throw new Error(`AaaS /api/packets returned ${res.status}`);
    }
    return JSON.parse(body) as PacketsResponse;
}

/** Every packet matching the filters, paged to exhaustion (newest last). */
async function all(params: Record<string, string | number>): Promise<Packet[]> {
    const out: Packet[] = [];
    let cursor: string | null | undefined;
    do {
        const res = await page(params, cursor);
        out.push(...(res.packets ?? []));
        cursor = res.hasMore ? res.nextCursor : null;
    } while (cursor);
    return out;
}

/**
 * Listing submissions and discovering the messenger both need the whole
 * User-ontology history — every user profile in the ecosystem, not just
 * platforms, because AaaS can only filter by ontology. That is currently ~15MB
 * over four pages and takes the better part of a minute, so the scan is cached
 * and served stale while it refreshes.
 *
 * The TTL must stay comfortably longer than a scan takes. A TTL shorter than
 * the scan expires before the scan that fills it has even finished, so every
 * request starts another full pass and the cache never serves anything.
 */
const FRESH_MS = 5 * 60_000;
const STALE_MS = 30 * 60_000;

interface PacketCache {
    at: number;
    packets: Packet[];
}

// Anchored outside the module graph for the same reason as the auth sessions:
// Vite's dev SSR can instantiate a module more than once, and a per-instance
// cache would leave some requests paying for a fresh scan every time.
const STORE = Symbol.for("ppa.aaas.userPackets");
const store = globalThis as typeof globalThis & {
    [STORE]?: { cache: PacketCache | null; inflight: Promise<Packet[]> | null };
};
store[STORE] ??= { cache: null, inflight: null };
const packetStore = store[STORE];

/** Starts a scan, collapsing concurrent callers onto one in-flight request. */
function refreshUserPackets(): Promise<Packet[]> {
    if (packetStore.inflight) return packetStore.inflight;
    const started = Date.now();
    packetStore.inflight = all({ ontology: USER_ONTOLOGY })
        .then((packets) => {
            packetStore.cache = { at: Date.now(), packets };
            console.log(
                `[ppa/aaas] scanned ${packets.length} profile packet(s) in ${((Date.now() - started) / 1000).toFixed(1)}s`,
            );
            return packets;
        })
        .finally(() => {
            packetStore.inflight = null;
        });
    return packetStore.inflight;
}

function allUserPackets(): Promise<Packet[]> {
    const cache = packetStore.cache;
    if (!cache) return refreshUserPackets();

    const age = Date.now() - cache.at;
    if (age < FRESH_MS) return Promise.resolve(cache.packets);
    if (age < STALE_MS) {
        // Serve what we have and bring it up to date behind the request, so a
        // reviewer never waits on the scan once it has run at least once.
        void refreshUserPackets().catch(() => {});
        return Promise.resolve(cache.packets);
    }
    return refreshUserPackets();
}

/** Drops the cached scan so the next read reflects a just-written change. */
export function invalidateUserPackets(): void {
    packetStore.cache = null;
}

// Warm the cache at startup so the first person to sign in does not wear the
// cost of the initial scan.
if (isReadConfigured() && !packetStore.cache && !packetStore.inflight) {
    void refreshUserPackets().catch((error) => {
        console.error("[ppa/aaas] initial scan failed:", error);
    });
}

function str(value: unknown): string {
    return typeof value === "string" ? value : "";
}

/**
 * PlatformProfile carries no author field today, so accept any of the shapes a
 * submitting platform might reasonably use, and fall back to the platform's own
 * eName so a submission is never left with nobody to talk to.
 */
function extractAuthors(
    data: Record<string, unknown>,
    platformEName: string,
): string[] {
    const candidates = [
        data.authorEnames,
        data.authors,
        data.ownerEName,
        data.submittedBy,
        data.contactEName,
    ];

    for (const candidate of candidates) {
        const values = Array.isArray(candidate) ? candidate : [candidate];
        const enames = values
            .map((v) => (typeof v === "string" ? v.trim() : ""))
            .filter(Boolean);
        if (enames.length > 0) return enames;
    }

    return [platformEName];
}

/** A platform profile packet, or null if this packet is something else. */
function asPlatformProfile(
    packet: Packet,
): { ename: string; data: Record<string, unknown> } | null {
    const data = packet.data;
    // The discovery marker: separates platform profiles from user profiles
    // sharing this ontology.
    if (!data || typeof data.platformName !== "string" || !data.platformName) {
        return null;
    }
    const ename = (packet.w3id ?? str(data.ename)) || "";
    if (!ename) return null;
    return { ename, data };
}

/**
 * The ontologies a platform declares it works with. Platforms publish this in
 * their self-description (as Meshenger does); an explicit `ontologies` field
 * is accepted too.
 */
function extractOntologies(data: Record<string, unknown>): string[] {
    const selfDescription = data.selfDescription as
        | { ontologies?: unknown }
        | undefined;
    const candidates = [selfDescription?.ontologies, data.ontologies];
    for (const candidate of candidates) {
        if (!Array.isArray(candidate)) continue;
        const ids = candidate
            .map((v) => (typeof v === "string" ? v.trim() : ""))
            .filter(Boolean);
        if (ids.length > 0) return [...new Set(ids)];
    }
    return [];
}

/**
 * Every platform currently asking for access, deduped by eName. Packets arrive
 * oldest first, so a plain Map keeps the last write — a platform that has since
 * cleared `inSubmission` correctly drops out of the queue.
 */
export async function listSubmissions(): Promise<Submission[]> {
    if (!awarenessApiKey()) {
        console.warn(
            "[ppa/aaas] PPA_AWARENESS_API_KEY / AWARENESS_API_KEY is not set — no submissions can be read",
        );
        return [];
    }

    const [packets, ontologyDomain] = await Promise.all([
        allUserPackets(),
        ontologyDomains(),
    ]);
    const byEname = new Map<string, Submission>();

    for (const packet of packets) {
        const profile = asPlatformProfile(packet);
        if (!profile) continue;

        const { ename, data } = profile;

        if (data.inSubmission !== true) {
            // Latest write withdrew (or never made) the application.
            byEname.delete(ename);
            continue;
        }

        const requestedOntologies = extractOntologies(data);
        // A platform asking for an ontology is asking for its domain.
        const requestedDomains = [
            ...new Set(
                requestedOntologies
                    .map((id) => ontologyDomain.get(id))
                    .filter((d): d is string => Boolean(d)),
            ),
        ];

        byEname.set(ename, {
            ename,
            platformName: str(data.platformName),
            displayName: str(data.displayName) || str(data.platformName),
            description: str(data.description),
            category: str(data.category) || "Other",
            version: str(data.version),
            url: str(data.url),
            logoUrl: str(data.logoUrl) || null,
            authorEnames: extractAuthors(data, ename),
            requestedOntologies: requestedOntologies,
            requestedDomains: requestedDomains,
            submissionEnvelopeId: packet.id,
            submittedAt: str(data.updatedAt) || str(data.createdAt) || packet.receivedAt,
            raw: data,
        });
    }

    return Array.from(byEname.values()).sort((a, b) =>
        a.submittedAt < b.submittedAt ? 1 : -1,
    );
}

/**
 * The messenger platform, discovered on the network like any other platform
 * rather than hardcoded. Returns null when it hasn't published a profile, in
 * which case the UI degrades to a copy-eName button.
 */
export async function findMessenger(): Promise<Messenger | null> {
    if (!awarenessApiKey()) return null;

    const wanted = messengerPlatformName().toLowerCase();
    const packets = await allUserPackets();

    let messenger: Messenger | null = null;
    for (const packet of packets) {
        const profile = asPlatformProfile(packet);
        if (!profile) continue;
        const { data } = profile;
        if (str(data.platformName).toLowerCase() !== wanted) continue;
        if (data.isArchived === true || data.isActive === false) {
            messenger = null;
            continue;
        }
        // Oldest-first ordering means the last match is the current profile.
        messenger = {
            displayName: str(data.displayName) || str(data.platformName),
            url: str(data.url) || null,
            handles: parseHandles(data.handles),
        };
    }
    return messenger;
}

/** Reads the `handles` a platform publishes, ignoring malformed entries. */
function parseHandles(value: unknown): PlatformHandle[] {
    if (!Array.isArray(value)) return [];
    const out: PlatformHandle[] = [];
    for (const raw of value) {
        if (!raw || typeof raw !== "object") continue;
        const h = raw as Record<string, unknown>;
        const openUrl = str(h.openUrl);
        const ontology = str(h.ontology);
        if (!openUrl || !ontology) continue;
        out.push({
            label: str(h.label) || "Open",
            ontology,
            openUrl,
            can: Array.isArray(h.can) ? h.can.filter((c) => typeof c === "string") : [],
            note: str(h.note) || null,
        });
    }
    return out;
}

/**
 * Builds the "contact this person" link.
 *
 * Preference order:
 *  1. A handle the messenger publishes for the User ontology — that is the
 *     messenger describing how to open a person, and it keeps working if it
 *     changes its routes.
 *  2. The known contact path (`/contacts/{ename}`). Meshenger opens a
 *     conversation there but does not yet declare it as a handle, so it cannot
 *     be discovered; once it does, branch 1 takes over on its own.
 *  3. The messenger's home page, so the button still goes somewhere real.
 */
export function messageLinkFor(
    messenger: Messenger | null,
    ename: string,
): { href: string; label: string } | null {
    if (!messenger) return null;

    const handle = messenger.handles.find(
        (h) => h.ontology === USER_ONTOLOGY && (h.can.length === 0 || h.can.includes("open")),
    );
    if (handle) {
        const href = handle.openUrl
            .replaceAll("{ontology}", encodeURIComponent(handle.ontology))
            .replaceAll("{w3id}", encodeURIComponent(ename));
        return { href, label: handle.label };
    }

    if (!messenger.url) return null;

    const path = messengerContactPath().replace(
        "{ename}",
        encodeURIComponent(ename),
    );
    try {
        return { href: new URL(path, messenger.url).toString(), label: "Message" };
    } catch {
        return { href: messenger.url, label: `Open ${messenger.displayName}` };
    }
}

/**
 * A person's profile, read from their own eVault's packets. Same field
 * assembly as platforms/profile-editor: last write wins.
 */
export async function getProfile(
    ename: string,
    messenger: Messenger | null,
): Promise<AuthorProfile> {
    const link = messageLinkFor(messenger, ename);
    const fallback: AuthorProfile = {
        ename,
        displayName: ename,
        handle: null,
        avatarUrl: null,
        bio: null,
        messageUrl: link?.href ?? null,
        messageLabel: link?.label ?? null,
    };

    if (!awarenessApiKey()) return fallback;

    let packets: Packet[];
    try {
        packets = await all({ evault: ename, ontology: USER_ONTOLOGY });
    } catch (error) {
        console.error(`[ppa/aaas] failed loading profile for ${ename}:`, error);
        return fallback;
    }

    let profile: Record<string, unknown> | null = null;
    for (const packet of packets) {
        const data = packet.data;
        if (!data) continue;
        // Skip the platform's own profile — we want the person, not the app.
        if (typeof data.platformName === "string" && data.platformName) continue;
        profile = data;
    }
    if (!profile) return fallback;

    return {
        ename,
        displayName:
            str(profile.displayName) || str(profile.name) || str(profile.username) || ename,
        handle: str(profile.username) || str(profile.handle) || null,
        avatarUrl: str(profile.avatarUrl) || str(profile.avatar) || null,
        bio: str(profile.bio) || str(profile.description) || null,
        messageUrl: link?.href ?? null,
        messageLabel: link?.label ?? null,
    };
}

/** Resolves every author of a submission, tolerating individual failures. */
export async function getAuthors(
    enames: string[],
    messenger: Messenger | null,
): Promise<AuthorProfile[]> {
    return Promise.all(enames.map((ename) => getProfile(ename, messenger)));
}

/**
 * Every decision the association has issued, newest first.
 *
 * Decisions have their own ontology, so unlike platform profiles they can be
 * asked for directly — a single small query instead of paging every profile on
 * the network. They live in the eVault of the platform each one is about, and
 * reach here through the usual awareness fanout, so a freshly written decision
 * takes a moment to appear.
 */
export async function listAccreditations(): Promise<Accreditation[]> {
    if (!awarenessApiKey()) return [];

    const packets = await all({ ontology: PLATFORM_ACCREDITATION_ONTOLOGY });
    const out: Accreditation[] = [];
    for (const packet of packets) {
        const data = packet.data;
        if (!data || typeof data.platformEName !== "string") continue;
        if (typeof data.jws !== "string") continue;
        out.push(data as unknown as Accreditation);
    }
    return out.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

/**
 * Key for one accreditation: a decision certifies a single platform version,
 * so a platform that ships a new version is unaccredited again until it is
 * reviewed afresh.
 */
export function accreditationKey(ename: string, version: string): string {
    return `${ename}@${version || "-"}`;
}

/**
 * The decision currently in force for each platform version. Records are
 * append-only, so "current" is the newest record for that platform + version.
 */
export async function currentAccreditations(): Promise<Map<string, Accreditation>> {
    const byVersion = new Map<string, Accreditation>();
    for (const record of await listAccreditations()) {
        const key = accreditationKey(record.platformEName, record.platformVersion);
        if (!byVersion.has(key)) byVersion.set(key, record);
    }
    return byVersion;
}
