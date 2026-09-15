/**
 * Deep-link flow state, shared by the root layout, the splash screen, /login
 * and /scan-qr.
 *
 * WHY THIS MODULE EXISTS
 *
 * A `w3ds://` URL that cold-starts the app has to survive a journey across
 * four independent pieces of code before the consent drawer can be shown:
 *
 *   root +layout   receives the URL (getCurrent / onOpenUrl)
 *   splash or /login   authenticates the user (biometric or PIN)
 *   postLogin      routes the authenticated user onward
 *   /scan-qr       finally renders the consent drawer
 *
 * Those pieces run CONCURRENTLY on a cold start. The URL may be delivered
 * before, during, or after authentication finishes, and on Android a
 * cold-start URL frequently arrives through the async `onOpenUrl` callback
 * *after* `getCurrent()` has already returned nothing. Every previous attempt
 * to fix the "consent screen disappears" bug assumed a fixed ordering, which
 * is why it only reproduced when biometric authentication completed quickly.
 *
 * The state here is deliberately order-independent. Whoever gets there first
 * records a fact; nobody infers ordering from the absence of a key.
 *
 * KEYS
 *
 *   pendingDeepLink    payload waiting for the user to authenticate
 *   deepLinkData       payload ready for /scan-qr to consume
 *   deepLinkFlowActive sticky marker: a deep link is somewhere in this flow.
 *                      Survives the pending -> data handover, so concurrent
 *                      code can ask "is a deep link in flight?" without
 *                      catching the one-instruction gap where neither payload
 *                      key is set.
 *   walletAuthenticated the user completed authentication this session. Lets a
 *                      LATE-arriving URL route straight to the consent screen
 *                      instead of bouncing off a stale "not on an
 *                      authenticated route" pathname check.
 *   authInFlight       an authenticate() call is currently awaiting the user.
 *                      While set, the layout must NOT issue its own
 *                      navigation: the post-auth routine owns routing, and two
 *                      concurrent goto() calls are exactly what used to strand
 *                      the user on /main with the payload unconsumed.
 */

const PENDING_KEY = "pendingDeepLink";
const DATA_KEY = "deepLinkData";
const ACTIVE_KEY = "deepLinkFlowActive";
const AUTHED_KEY = "walletAuthenticated";
const AUTH_IN_FLIGHT_KEY = "walletAuthInFlight";
const LAST_URL_KEY = "deepLinkLastUrl";

function store(): Storage | null {
    try {
        return typeof sessionStorage === "undefined" ? null : sessionStorage;
    } catch {
        // Private-mode / disabled storage: degrade to "no deep link in flight"
        // rather than throwing inside a deep-link callback.
        return null;
    }
}

/* ---------------------------------------------------------------- payloads */

/** A deep link arrived and the user still has to authenticate. */
export function markDeepLinkPending(data: unknown): void {
    const s = store();
    if (!s) return;
    s.setItem(PENDING_KEY, JSON.stringify(data));
    s.setItem(ACTIVE_KEY, "true");
}

/** A deep link arrived and the user is already authenticated. */
export function markDeepLinkReady(data: unknown): void {
    const s = store();
    if (!s) return;
    s.setItem(DATA_KEY, JSON.stringify(data));
    s.removeItem(PENDING_KEY);
    s.setItem(ACTIVE_KEY, "true");
}

/**
 * True from the moment a deep link is received until /scan-qr has consumed it.
 * Safe to call from code running concurrently with authentication.
 */
export function isDeepLinkFlowActive(): boolean {
    const s = store();
    if (!s) return false;
    return (
        s.getItem(ACTIVE_KEY) === "true" ||
        !!s.getItem(PENDING_KEY) ||
        !!s.getItem(DATA_KEY)
    );
}

/**
 * Promote a pending payload to a ready one once authentication succeeds.
 * Returns true when there was something to promote.
 */
export function promotePendingDeepLink(): boolean {
    const s = store();
    if (!s) return false;
    const pending = s.getItem(PENDING_KEY);
    if (!pending) return false;
    s.setItem(DATA_KEY, pending);
    s.removeItem(PENDING_KEY);
    s.setItem(ACTIVE_KEY, "true");
    return true;
}

/** Read the payload without consuming it. */
export function peekDeepLinkPayload(): string | null {
    const s = store();
    if (!s) return null;
    return s.getItem(DATA_KEY) ?? s.getItem(PENDING_KEY);
}

/** The flow is finished: handled, declined, or failed. */
export function clearDeepLinkFlow(): void {
    const s = store();
    if (!s) return;
    s.removeItem(PENDING_KEY);
    s.removeItem(DATA_KEY);
    s.removeItem(ACTIVE_KEY);
    // Release the dedupe guard too. It only exists to collapse the duplicate
    // delivery of a single URL; once that URL has been consumed, the very same
    // link presented again is a legitimate new request and must not be
    // swallowed.
    s.removeItem(LAST_URL_KEY);
}

/* ------------------------------------------------------------ dedupe guard */

/**
 * True when this exact URL is already being handled.
 *
 * Android delivers a cold-start URL through BOTH `getCurrent()` and the
 * `onOpenUrl` callback. Handling it twice fires two navigations at the consent
 * screen and the second can unmount the drawer the first just opened.
 *
 * The guard is scoped to the lifetime of one flow rather than to the session:
 * `clearDeepLinkFlow` releases it, so re-presenting the same link after it has
 * been dealt with works normally. Storage-backed rather than a module variable
 * so it survives the navigations this flow performs.
 */
export function isDuplicateDelivery(urlString: string): boolean {
    const s = store();
    if (!s) return false;
    if (s.getItem(LAST_URL_KEY) === urlString) return true;
    s.setItem(LAST_URL_KEY, urlString);
    return false;
}

/* ------------------------------------------------------------ auth signals */

/** Record that the user finished authenticating in this session. */
export function markWalletAuthenticated(): void {
    store()?.setItem(AUTHED_KEY, "true");
}

/** Has the user authenticated at any point in this session? */
export function isWalletAuthenticated(): boolean {
    return store()?.getItem(AUTHED_KEY) === "true";
}

/**
 * Bracket an authenticate() / PIN-verify call. While a prompt is in flight the
 * deep-link handler defers all navigation to the post-auth routine, so the two
 * cannot race each other to a different destination.
 */
export function beginAuthPrompt(): void {
    store()?.setItem(AUTH_IN_FLIGHT_KEY, "true");
}

export function endAuthPrompt(): void {
    store()?.removeItem(AUTH_IN_FLIGHT_KEY);
}

export function isAuthPromptInFlight(): boolean {
    return store()?.getItem(AUTH_IN_FLIGHT_KEY) === "true";
}

/**
 * Wipe every trace of this login session. Call on logout.
 *
 * `walletAuthenticated` in particular MUST be cleared here. Logout resets the
 * global state and does an SPA navigation to "/", which leaves sessionStorage
 * intact — so without this the session would keep claiming the user is
 * authenticated, and a deep link arriving afterwards would route itself to the
 * consent screen instead of to /login. The (app) vault guard does catch that
 * and bounce the user back, but relying on a second guard for a decision we
 * can state correctly here is not a safety property worth betting on.
 */
export function resetAuthSession(): void {
    const s = store();
    if (!s) return;
    clearDeepLinkFlow();
    s.removeItem(AUTHED_KEY);
    s.removeItem(AUTH_IN_FLIGHT_KEY);
}
