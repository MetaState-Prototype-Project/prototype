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
    try {
        store()?.setItem(PAYLOAD_KEY, JSON.stringify(data));
    } catch (error) {
        // Reaching storage can succeed while writing to it fails. This runs
        // inside the deep-link callback the comment above describes, so a
        // throw here is invisible and strands the flow.
        console.warn("Could not store the deep-link payload:", error);
    }
}

/** The payload the consent screen should render, if any. */
export function peekDeepLink(): string | null {
    try {
        return store()?.getItem(PAYLOAD_KEY) ?? null;
    } catch (error) {
        console.warn("Could not read the deep-link payload:", error);
        return null;
    }
}

/** Is there a deep link waiting to be consented to? */
export function hasDeepLink(): boolean {
    return peekDeepLink() !== null;
}

/** Clear the payload once the consent screen has shown it, or on logout. */
export function clearDeepLink(): void {
    try {
        store()?.removeItem(PAYLOAD_KEY);
    } catch (error) {
        // Called from performLogout() alongside GlobalState.reset(); a throw
        // here would skip the navigation that ends the session.
        console.warn("Could not clear the deep-link payload:", error);
    }
}
