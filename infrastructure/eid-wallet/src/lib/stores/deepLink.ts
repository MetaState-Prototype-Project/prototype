/**
 * The pending deep-link payload.
 *
 * sessionStorage because the payload has to survive the full-page navigations
 * the wallet performs between the splash, /login and /scan-qr, and the webview
 * rebuild Android may perform while the app is backgrounded by openUrl.
 *
 * See docs/architecture/deepLink.md.
 */

const PAYLOAD_KEY = "deepLinkData";

function store(): Storage | null {
    try {
        return typeof sessionStorage === "undefined" ? null : sessionStorage;
    } catch {
        // Private mode / storage disabled. Degrade to "no deep link" rather
        // than throwing inside a deep-link callback.
        return null;
    }
}

/** Store an incoming deep-link payload, whatever the authentication state. */
export function storeDeepLink(data: unknown): void {
    store()?.setItem(PAYLOAD_KEY, JSON.stringify(data));
}

/** The payload the consent screen should render, if any. */
export function peekDeepLink(): string | null {
    return store()?.getItem(PAYLOAD_KEY) ?? null;
}

/** Is there a deep link waiting to be consented to? */
export function hasDeepLink(): boolean {
    return peekDeepLink() !== null;
}

/** Clear the payload once the consent screen has shown it, or on logout. */
export function clearDeepLink(): void {
    store()?.removeItem(PAYLOAD_KEY);
}
