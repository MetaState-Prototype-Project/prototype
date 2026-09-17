/**
 * Deep-link login: the rendezvous between URL delivery and authentication.
 *
 * A third-party site hands the wallet a `w3ds://auth?session=...` URL. Showing
 * the Approve/Decline consent screen for it requires TWO independent things to
 * finish, in an order nobody controls:
 *
 *   1. The URL arriving. The root layout imports the deep-link plugin
 *      asynchronously, then asks it for the launch URL.
 *   2. The user authenticating. On a cold start the splash prompts for
 *      biometrics, which can succeed in ~200ms or take seconds.
 *
 * Whoever finishes LAST owns the routing. That is the whole design:
 *
 *   - URL arrives while unauthenticated -> park it, route nothing.
 *   - Authentication completes -> check for a parked URL and route to it.
 *   - URL arrives while already authenticated -> route to it immediately.
 *
 * Both sides check the same two facts, so neither can act on a half-finished
 * picture. The bug this replaces came from the layout inferring "is the user
 * authenticated?" from `window.location.pathname` at the instant of delivery:
 * on a cold start the path is "/" (the splash) no matter how the race went, so
 * a user who had ALREADY authenticated was still classified as logged out. The
 * payload was parked for a screen that had finished running, and the user
 * landed on /main with the consent screen never shown.
 *
 * Authentication state is therefore recorded EXPLICITLY, by the code that
 * performs the authentication, and never derived from the URL.
 */

const PENDING_KEY = "pendingDeepLink";
const DATA_KEY = "deepLinkData";
const AUTHED_KEY = "walletAuthenticated";

function store(): Storage | null {
    try {
        return typeof sessionStorage === "undefined" ? null : sessionStorage;
    } catch {
        // Private mode / storage disabled: degrade to "nothing in flight"
        // rather than throwing inside a deep-link callback.
        return null;
    }
}

/**
 * Record that the user is through the authentication gate.
 *
 * Deliberately sessionStorage, NOT localStorage. Being forgotten when the app
 * is killed is exactly the property that makes this safe: a deep link arriving
 * after a cold start must trigger a real authentication, not inherit one from
 * a previous run.
 */
export function markWalletAuthenticated(): void {
    store()?.setItem(AUTHED_KEY, "true");
}

export function isWalletAuthenticated(): boolean {
    return store()?.getItem(AUTHED_KEY) === "true";
}

/**
 * Park a payload that arrived before the user finished authenticating.
 * Whoever completes authentication collects it.
 */
export function markDeepLinkPending(data: unknown): void {
    store()?.setItem(PENDING_KEY, JSON.stringify(data));
}

/** Hand a payload directly to /scan-qr: the user is already authenticated. */
export function markDeepLinkReady(data: unknown): void {
    store()?.setItem(DATA_KEY, JSON.stringify(data));
}

/**
 * Promote a parked payload to a ready one. Called at the end of every
 * authentication path (biometric on the splash, PIN on /login).
 *
 * Returns true if there was something to promote, which is the caller's signal
 * to route to /scan-qr instead of /main.
 */
export function promotePendingDeepLink(): boolean {
    const s = store();
    const pending = s?.getItem(PENDING_KEY);
    if (!pending) return false;
    s?.setItem(DATA_KEY, pending);
    s?.removeItem(PENDING_KEY);
    return true;
}

/** The payload /scan-qr should render, from either delivery path. */
export function peekDeepLinkPayload(): string | null {
    const s = store();
    return s?.getItem(DATA_KEY) ?? s?.getItem(PENDING_KEY) ?? null;
}

/** Clear the payload once the consent screen has been shown. */
export function clearDeepLinkFlow(): void {
    const s = store();
    s?.removeItem(PENDING_KEY);
    s?.removeItem(DATA_KEY);
}

/**
 * Wipe the session on logout.
 *
 * `walletAuthenticated` MUST be cleared here. Logout resets global state and
 * does an SPA navigation to "/", which leaves sessionStorage intact, so
 * without this the next deep link would route itself straight to the consent
 * screen on the strength of a login that has already ended.
 */
export function resetAuthSession(): void {
    clearDeepLinkFlow();
    store()?.removeItem(AUTHED_KEY);
}
