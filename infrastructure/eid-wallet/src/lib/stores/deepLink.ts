/**
 * State for the deep-link login flow.
 *
 * Showing the Approve/Decline consent screen requires TWO independent things
 * to finish, in an order nobody controls:
 *
 *   1. The URL arriving. The root layout imports the deep-link plugin
 *      asynchronously, then asks it for the launch URL.
 *   2. The user authenticating. On a cold start the splash prompts for
 *      biometrics, which can succeed in ~200ms or take seconds.
 *
 * Whoever finishes LAST owns the routing:
 *
 *   - The URL arrives while unauthenticated -> store it, route nothing. The
 *     screen that completes authentication picks it up.
 *   - The URL arrives while authenticated -> route to the consent screen now.
 *
 * There is ONE payload slot. Storing a deep link never implies permission to
 * act on it: that is `isAuthenticated()`, which both sides check.
 *
 * The bug this replaces came from the layout inferring "is the user
 * authenticated?" from `window.location.pathname` at the instant of delivery:
 * on a cold start the path is "/" for the splash regardless of how the race
 * went, so a user who had ALREADY authenticated was still classified as
 * logged out. The payload was stored for a screen that had finished running,
 * and the user landed on /main with the consent screen never shown.
 *
 * Authentication state is therefore recorded EXPLICITLY, by the code that
 * performs the authentication, and never derived from the URL.
 *
 * Deliberately sessionStorage rather than a Svelte store or localStorage:
 *
 *  - A Svelte store is in-memory, and this state has to survive the full-page
 *    navigations the wallet performs between the splash, /login and /scan-qr.
 *    An in-memory store would be empty on the other side.
 *  - localStorage would survive the app being killed, which is exactly wrong
 *    for the authenticated flag: a deep link arriving after a cold start must
 *    trigger a real authentication, not inherit one from a previous run.
 *    Being forgotten on relaunch is the property that makes it safe.
 *
 * Every accessor degrades to "nothing stored" when storage is unavailable
 * (private mode, storage disabled) rather than throwing, because these are
 * called from deep-link callbacks where a throw is invisible to the user and
 * strands the flow.
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
 * Wipe the session on logout.
 *
 * The authenticated flag MUST be cleared here. Logout resets global state and
 * does an SPA navigation to "/", which leaves sessionStorage intact, so
 * without this the session would keep claiming the user is authenticated and
 * the next deep link would route itself straight to the consent screen on the
 * strength of a login that has already ended.
 */
export function resetAuthSession(): void {
    const s = store();
    s?.removeItem(PAYLOAD_KEY);
    s?.removeItem(AUTHED_KEY);
}
