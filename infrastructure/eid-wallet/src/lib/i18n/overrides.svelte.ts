import { PUBLIC_TRANSLATIONS_URL } from "$env/static/public";
import { validateCatalog } from "./catalog";

const CACHE_KEY = "eid-wallet.translation-overrides";

function readCache(): Record<string, Record<string, string>> {
    if (typeof localStorage === "undefined") return {};
    try {
        const raw = localStorage.getItem(CACHE_KEY);
        return raw ? JSON.parse(raw) : {};
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
        localStorage.setItem(CACHE_KEY, JSON.stringify(accepted));
    } catch {
        // A full or disabled store only costs the head start next launch.
    }
}

// `no-cache` still honours a 304, so an unchanged catalog is not re-downloaded.
export async function refreshOverrides(): Promise<void> {
    if (!PUBLIC_TRANSLATIONS_URL) return;
    try {
        const response = await fetch(PUBLIC_TRANSLATIONS_URL, {
            cache: "no-cache",
        });
        if (!response.ok) return;
        applyCatalog(await response.json());
    } catch {
        // Offline: the cache and the compiled strings both still render.
    }
}
