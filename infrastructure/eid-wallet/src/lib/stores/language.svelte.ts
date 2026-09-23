import {
    type Locale,
    getLocale,
    isLocale,
    overwriteGetLocale,
    setLocale,
} from "$lib/paraglide/runtime";

export interface Language {
    name: string;
    locale: string;
    /** ISO 3166-1 country code, not the language code: Ukrainian is `uk`
     *  but its flag is `ua`. */
    country: string;
    enabled: boolean;
}

export const AVAILABLE_LANGUAGES: Language[] = [
    { name: "English", locale: "en", country: "gb", enabled: true },
    { name: "Русский", locale: "ru", country: "ru", enabled: true },
    { name: "Українська", locale: "uk", country: "ua", enabled: true },
    { name: "Español", locale: "es", country: "es", enabled: false },
    { name: "Deutsch", locale: "de", country: "de", enabled: false },
    { name: "Français", locale: "fr", country: "fr", enabled: false },
    { name: "Lëtzebuergesch", locale: "lb", country: "lu", enabled: false },
    { name: "Nederlands", locale: "nl", country: "nl", enabled: false },
];

// Resolved once through paraglide's chain, then read through a rune so
// `m.*()` re-runs on a switch. A reload would repaint too, but in a Tauri
// webview it drops the unlocked session.
let current = $state<Locale>(getLocale());
overwriteGetLocale(() => current);

// `reload: false` leaves document state alone, so without this <html lang>
// stays "en" and screen readers apply English pronunciation to Cyrillic.
function syncDocumentLang(locale: Locale) {
    if (typeof document === "undefined") return;
    document.documentElement.lang = locale;
}

syncDocumentLang(current);

export function getCurrentLanguage(): Language {
    return (
        AVAILABLE_LANGUAGES.find((l) => l.locale === current) ??
        AVAILABLE_LANGUAGES[0]
    );
}

export function setCurrentLanguage(locale: string): void {
    if (!isLocale(locale) || locale === current) return;
    if (!AVAILABLE_LANGUAGES.find((l) => l.locale === locale)?.enabled) return;
    current = locale;
    syncDocumentLang(locale);
    setLocale(locale, { reload: false });
}
