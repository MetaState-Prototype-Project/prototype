/**
 * Holds the corrections fetched from `PUBLIC_TRANSLATIONS_URL` so wording can
 * be fixed without an app store release.
 *
 * The compiled catalog in the binary stays the source of truth and the
 * fallback: a correction only ever replaces a string that already shipped.
 */

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

// Seeded from cache synchronously so a correction already fetched once is on
// screen at first paint instead of arriving as a flicker mid-session.
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
        // A full or disabled store only costs us the head start next launch.
    }
}

export async function refreshOverrides(): Promise<void> {
    if (!PUBLIC_TRANSLATIONS_URL) return;
    try {
        const response = await fetch(PUBLIC_TRANSLATIONS_URL, {
            cache: "no-store",
        });
        if (!response.ok) return;
        applyCatalog(await response.json());
    } catch {
        // Offline or unreachable: cached corrections and the bundled strings
        // both still render, so there is nothing to recover from.
    }
}
