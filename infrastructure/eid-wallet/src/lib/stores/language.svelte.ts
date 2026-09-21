import {
    type Locale,
    getLocale,
    isLocale,
    overwriteGetLocale,
    setLocale,
} from "$lib/paraglide/runtime";

export interface Language {
    /** The language's name in its own language, so it stays recognizable
     *  whatever the UI is currently set to. */
    name: string;
    /** Paraglide locale code. Languages without messages still carry theirs so
     *  enabling one is a one-line change here. */
    locale: string;
    /** ISO 3166-1 alpha-2 country code (lowercased) used for `fi-${country}`
     *  flag rendering. Not the language code — Ukrainian is `uk` but `ua`. */
    country: string;
    /** Whether localized strings exist for this language yet. Only enabled
     *  languages can be selected by the user. */
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

// Resolve once through paraglide's own chain (localStorage → device language →
// base locale), then hand every later read to a rune, so the `m.*()` calls in
// components re-run when the user switches. Without this the app would need a
// reload to repaint, and in a Tauri webview that drops the unlocked session.
let current = $state<Locale>(getLocale());
overwriteGetLocale(() => current);

// Paraglide's `reload: false` path deliberately leaves document state alone,
// so <html lang> would sit at "en" forever and assistive tech would read
// Russian and Ukrainian with English pronunciation rules.
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
