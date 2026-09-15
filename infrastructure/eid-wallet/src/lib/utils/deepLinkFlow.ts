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
 *   walletAuthenticated the user completed authentication this session. Lets a
 *                      LATE-arriving URL route straight to the consent screen
 *                      instead of bouncing off a stale "not on an
 *                      authenticated route" pathname check.
 *   authInFlight       an authenticate() call is currently awaiting the user.
 *                      While set, the layout must NOT issue its own
 *                      navigation: the post-auth routine owns routing, and two
 *                      concurrent goto() calls are exactly what used to strand
 *                      the user on /main with the payload unconsumed.
 *
 * WHY THERE IS NO SEPARATE "FLOW ACTIVE" MARKER
 *
 * There used to be a sticky `deepLinkFlowActive` key here, justified by a
 * supposed instant during promotion where neither payload key was set. That
 * instant does not exist: `promotePendingDeepLink` writes `deepLinkData`
 * BEFORE removing `pendingDeepLink`, with no await in between, and every
 * reader checks both keys. The payload is therefore visible under one key or
 * the other at every observable moment.
 *
 * The sticky key was not merely redundant, it was harmful. It deliberately
 * outlived the payload, so a login that had already been used still looked
 * pending and was offered to the user again and again. The payload IS the
 * request: when it is gone, the request is over.
 */

const PENDING_KEY = "pendingDeepLink";
const DATA_KEY = "deepLinkData";
const AUTHED_KEY = "walletAuthenticated";
const AUTH_IN_FLIGHT_KEY = "walletAuthInFlight";
const LAST_URL_KEY = "deepLinkLastUrl";
const HANDLED_URL_KEY = "deepLinkHandledUrl";

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
}

/** A deep link arrived and the user is already authenticated. */
export function markDeepLinkReady(data: unknown): void {
    const s = store();
    if (!s) return;
    s.setItem(DATA_KEY, JSON.stringify(data));
    s.removeItem(PENDING_KEY);
}

/**
 * True while a deep-link request is still waiting to be dealt with.
 *
 * This is exactly "a payload is present", under either key. Once the consent
 * screen has consumed the payload the request is finished, and this reports
 * false — which is what stops a spent login being offered again.
 */
export function isDeepLinkFlowActive(): boolean {
    return !!peekDeepLinkPayload();
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
    // Order matters: write the new key before dropping the old one, so a
    // concurrent reader always sees the payload under one key or the other.
    s.setItem(DATA_KEY, pending);
    s.removeItem(PENDING_KEY);
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
    // Promote the in-flight URL to "already handled". The request is over, so
    // any further delivery of that same URL is a replay to be ignored — but we
    // must remember WHICH url, rather than forgetting it. See
    // isDuplicateDelivery.
    const inFlight = s.getItem(LAST_URL_KEY);
    if (inFlight) {
        s.setItem(HANDLED_URL_KEY, inFlight);
        s.removeItem(LAST_URL_KEY);
    }
}

/* ------------------------------------------------------------ dedupe guard */

/**
 * True when this exact URL is already being handled.
 *
 * Android delivers a cold-start URL through BOTH `getCurrent()` and the
 * `onOpenUrl` callback. Handling it twice fires two navigations at the consent
 * screen and the second can unmount the drawer the first just opened.
 *
 * A URL is suppressed in two distinct situations, and conflating them breaks
 * one flow or the other:
 *
 *   in flight  this URL is the request currently being processed. The second
 *              delivery of it is Android's duplicate and must be dropped.
 *   handled    the request finished. Every later delivery is the plugin
 *              replaying a stale intent (the activity is `singleTask` and it
 *              never clears `currentUrl`), and restarting the login from it
 *              loops forever.
 *
 * Both are suppressed, but the marker is never simply FORGOTTEN: forgetting is
 * what let the replay look new and restart the loop. It is moved from
 * "in flight" to "handled" when the flow is cleared.
 *
 * A deep link is identified by its `session`, which the platform generates
 * fresh per login request (uuid v4), so a genuinely new request carries a
 * different URL and is never suppressed by either marker.
 *
 * Storage-backed rather than a module variable so it survives the navigations
 * this flow performs.
 */
export function isDuplicateDelivery(urlString: string): boolean {
    const s = store();
    if (!s) return false;
    if (s.getItem(HANDLED_URL_KEY) === urlString) return true;
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
 * Should a pre-app screen abandon an async routine it started earlier?
 *
 * Unmounting a Svelte component does NOT cancel an `onMount` that is parked on
 * an `await`; the continuation resumes later and will happily call `goto()`
 * from a screen the user left long ago. The splash sleeps for its intro
 * animation and then awaits storage and the deep-link handshake, so on a cold
 * start it is still suspended while the user authenticates and /scan-qr opens
 * the consent drawer. Waking up at that point and running its tail is what
 * tears the drawer back down.
 *
 * Callers pass their own destroyed flag (set from onDestroy). The second
 * condition catches the subtler case where the component has not been
 * destroyed yet but the session is already authenticated, which means another
 * screen owns navigation now.
 *
 * Bailing out is always safe: it only skips navigation, and never touches the
 * deep-link payload the live screen still has to consume.
 */
export function shouldAbortStaleContinuation(destroyed: boolean): boolean {
    return destroyed || isWalletAuthenticated();
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
    s.removeItem(HANDLED_URL_KEY);
    s.removeItem(LAST_URL_KEY);
    s.removeItem(AUTHED_KEY);
    s.removeItem(AUTH_IN_FLIGHT_KEY);
}
