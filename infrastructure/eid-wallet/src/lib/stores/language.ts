export interface Language {
    /** Display name, e.g. "English". */
    name: string;
    /** ISO 3166-1 alpha-2 country code (lowercased) used for `fi-${country}`
     *  flag rendering. */
    country: string;
    /** Whether localized strings exist for this language yet. Only enabled
     *  languages can be selected by the user. */
    enabled: boolean;
}

export const AVAILABLE_LANGUAGES: Language[] = [
    { name: "English", country: "gb", enabled: true },
    { name: "Spanish", country: "es", enabled: true },
    { name: "German", country: "de", enabled: true },
    { name: "French", country: "fr", enabled: true },
    { name: "Luxembourgish", country: "lu", enabled: true },
    { name: "Dutch", country: "nl", enabled: true },
];

const STORAGE_KEY = "eid_wallet_language";
const DEFAULT = AVAILABLE_LANGUAGES[0];

let cached: Language | null = null;
let listeners: Array<() => void> = [];

function loadFromStorage(): Language {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
            const parsed = JSON.parse(raw) as { name?: string };
            const found = AVAILABLE_LANGUAGES.find(
                (l) => l.name === parsed.name && l.enabled,
            );
            if (found) return found;
        }
    } catch {
        // ignore — fall through to default
    }
    return DEFAULT;
}

function notify() {
    for (const fn of listeners) fn();
}

export function getCurrentLanguage(): Language {
    if (cached) return cached;
    cached = loadFromStorage();
    return cached;
}

export function setCurrentLanguage(name: string): void {
    const found = AVAILABLE_LANGUAGES.find((l) => l.name === name);
    if (!found || !found.enabled) return;
    if (cached?.name === found.name) return;
    cached = found;
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ name: found.name }));
    } catch (error) {
        console.warn("Failed to persist language preference:", error);
    }
    notify();
}

export function subscribe(fn: () => void): () => void {
    listeners.push(fn);
    return () => {
        listeners = listeners.filter((l) => l !== fn);
    };
}
