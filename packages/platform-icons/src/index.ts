/**
 * Lookup helpers for the brand icons shipped in `./icons`. Icons themselves
 * are imported by consumers via `@metastate-foundation/platform-icons/icons/<key>.<ext>`
 * (see KNOWN_PLATFORM_ICONS for the file extension per key).
 *
 * Keys correspond to the first subdomain segment of each platform's hostname,
 * e.g. `evoting.w3ds.metastate.foundation` → `evoting`.
 */

export const KNOWN_PLATFORM_ICONS = {
    blabsy: "blabsy.svg",
    charter: "charter.png",
    ecurrency: "ecurrency.png",
    "eid-w3ds": "eid-w3ds.png",
    emover: "emover.png",
    ereputation: "ereputation.png",
    esigner: "esigner.png",
    evoting: "evoting.png",
    "file-manager": "file-manager.png",
    marketplace: "marketplace.ico",
    pictique: "pictique.svg",
    "profile-editor": "profile-editor.png",
    w3ds: "w3dslogo.svg",
} as const;

export type PlatformKey = keyof typeof KNOWN_PLATFORM_ICONS;

/**
 * Extract the platform key (first subdomain segment, lowercased) from a hostname
 * and return it only if we ship an icon for that key. Returns null otherwise so
 * callers can decide on a fallback.
 */
export function getPlatformKey(
    hostname: string | null | undefined,
): PlatformKey | null {
    if (!hostname) return null;
    const first = hostname.split(".")[0]?.toLowerCase();
    if (!first) return null;
    return first in KNOWN_PLATFORM_ICONS ? (first as PlatformKey) : null;
}
