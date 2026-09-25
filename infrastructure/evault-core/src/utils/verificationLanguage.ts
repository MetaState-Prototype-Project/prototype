/**
 * Didit renders its verification UI in the language passed at session
 * creation. Without it Didit falls back to detecting the browser language,
 * which does not work inside the wallet's webview, so the screens come out in
 * English however the app is set.
 *
 * Codes Didit documents, as of 2026-09. An unlisted code falls back to `en`
 * rather than reaching Didit: a rejected session creation would stop
 * verification and recovery from starting at all.
 * See https://docs.didit.me/sessions-api/create-session
 */

const SUPPORTED = new Set([
    "ar", "bg", "bn", "bs", "ca", "cnr", "cs", "da", "de", "el", "en", "es",
    "et", "fa", "fi", "fr", "he", "hi", "hr", "hu", "hy", "id", "it", "ja",
    "ka", "kk", "ko", "ky", "lt", "lv", "mk", "mn", "ms", "nl", "no", "pl",
    "pt", "pt-BR", "ro", "ru", "sk", "sl", "so", "sq", "sr", "sv", "th", "tr",
    "uk", "uz", "vi", "zh", "zh-CN", "zh-TW",
]);

export function verificationLanguage(value: unknown): string {
    return typeof value === "string" && SUPPORTED.has(value) ? value : "en";
}
