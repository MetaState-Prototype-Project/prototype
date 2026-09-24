/**
 * Didit renders its verification UI in the language passed at session
 * creation. Without it Didit falls back to detecting the browser language,
 * which does not work inside the wallet's webview, so the screens come out in
 * English however the app is set.
 *
 * Codes are ISO 639-1, matching the wallet's own locales.
 * See https://docs.didit.me/sessions-api/create-session
 */

const ISO_639_1 = /^[a-z]{2}(-[A-Z]{2})?$/;

export function verificationLanguage(value: unknown): string {
    return typeof value === "string" && ISO_639_1.test(value) ? value : "en";
}
