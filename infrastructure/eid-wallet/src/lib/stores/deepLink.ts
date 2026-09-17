/**
 * State for the deep-link login flow.
 *
 * See docs/architecture/deepLink.md for the flow this state serves.
 */

const PAYLOAD_KEY = "deepLinkData";
const AUTHED_KEY = "walletAuthenticated";

function store(): Storage | null {
    try {
        return typeof sessionStorage === "undefined" ? null : sessionStorage;
    } catch {
        return null;
    }
}

/**
 * Record that the user is through the authentication gate.
 *
 * Callers must do this BEFORE any await that precedes their navigation, so a
 * deep link delivered mid-flight sees the user as authenticated and routes
 * itself rather than storing a payload nobody is left to collect.
 */
export function markAuthenticated(): void {
    store()?.setItem(AUTHED_KEY, "true");
}

export function isAuthenticated(): boolean {
    return store()?.getItem(AUTHED_KEY) === "true";
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

/** Clear the payload once the consent screen has shown it. */
export function clearDeepLink(): void {
    store()?.removeItem(PAYLOAD_KEY);
}

/**
 * Wipe the session on logout. Clearing the authenticated flag is required:
 * logout is an SPA navigation and leaves sessionStorage intact.
 */
export function resetAuthSession(): void {
    const s = store();
    s?.removeItem(PAYLOAD_KEY);
    s?.removeItem(AUTHED_KEY);
}
