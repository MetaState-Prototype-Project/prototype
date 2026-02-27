/**
 * W3DS Gateway — Shared Utilities
 */

/**
 * Returns true only for http: and https: URLs.
 * Rejects javascript:, data:, and any other scheme.
 */
export function isSafeUrl(url: string): boolean {
    try {
        const { protocol } = new URL(url);
        return protocol === "http:" || protocol === "https:";
    } catch {
        return false;
    }
}
