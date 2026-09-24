import { PUBLIC_TRANSLATIONS_URL } from "$env/static/public";
import { isTransportSafe, validateCatalog } from "./catalog";

const CACHE_KEY = "eid-wallet.translation-overrides";

// Revalidated rather than trusted: the rules live in the binary, so a release
// that renames a placeholder or turns a key into a plural would otherwise keep
// rendering the previous build's correction.
function readCache(): Record<string, Record<string, string>> {
    if (typeof localStorage === "undefined") return {};
    try {
        const raw = localStorage.getItem(CACHE_KEY);
        if (!raw) return {};
        const { accepted, fatal } = validateCatalog(JSON.parse(raw));
        return fatal ? {} : accepted;
    } catch {
        return {};
    }
}

// Seeded synchronously so a correction fetched earlier is on screen at
// first paint rather than arriving as a flicker.
let table = $state<Record<string, Record<string, string>>>(readCache());

export function lookup(locale: string, key: string): string | undefined {
    return table[locale]?.[key];
}

export function applyCatalog(raw: unknown): void {
    const { accepted, rejected, fatal } = validateCatalog(raw);
    if (fatal) {
        console.warn(`[i18n] correction catalog discarded: ${fatal}`);
        return;
    }
    if (rejected.length > 0) {
        console.warn(
            `[i18n] ${rejected.length} correction(s) refused`,
            rejected,
        );
    }
    table = accepted;
    if (typeof localStorage === "undefined") return;
    try {
        localStorage.setItem(CACHE_KEY, JSON.stringify(raw));
    } catch {
        // A full or disabled store only costs the head start next launch.
    }
}

// `no-cache` still honours a 304, so an unchanged catalog is not re-downloaded.
export async function refreshOverrides(): Promise<void> {
    if (!PUBLIC_TRANSLATIONS_URL) return;
    if (!isTransportSafe(PUBLIC_TRANSLATIONS_URL)) {
        console.warn(
            "[i18n] refusing to fetch corrections over an insecure URL:",
            PUBLIC_TRANSLATIONS_URL,
        );
        return;
    }
    try {
        const response = await fetch(PUBLIC_TRANSLATIONS_URL, {
            cache: "no-cache",
        });
        if (!response.ok) return;
        applyCatalog(await response.json());
    } catch (error) {
        // Genuinely offline is fine: the cache and the compiled strings both
        // still render. A wrong URL or a catalog served without CORS lands
        // here too, and is invisible without this.
        console.warn("[i18n] correction catalog unavailable:", error);
    }
}
