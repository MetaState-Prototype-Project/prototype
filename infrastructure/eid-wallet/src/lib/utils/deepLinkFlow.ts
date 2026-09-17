/**
 * Deep-link login: the rendezvous between URL delivery and authentication.
 *
 * State lives in lib/stores/deepLink.ts; this module is the logic that uses
 * it. Showing the Approve/Decline consent screen requires TWO independent
 * things to finish, in an order nobody controls:
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
 * act on it: that is `isWalletAuthenticated()`, which both sides check. The
 * earlier design had a pending slot and a ready slot, and "promoted" between
 * them, but the copy carried no information — the payload was identical and
 * every consumer had to read both slots anyway.
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
 */

import {
    clearAuthenticated,
    clearPayload,
    getAuthenticated,
    getPayload,
    setAuthenticated,
    setPayload,
} from "$lib/stores/deepLink";

/**
 * Record that the user is through the authentication gate.
 *
 * Callers must do this BEFORE any await that precedes their navigation, so a
 * deep link delivered mid-flight sees the user as authenticated and routes
 * itself rather than storing a payload nobody is left to collect.
 */
export function markWalletAuthenticated(): void {
    setAuthenticated();
}

export function isWalletAuthenticated(): boolean {
    return getAuthenticated();
}

/** Store an incoming deep-link payload, whatever the authentication state. */
export function storeDeepLink(data: unknown): void {
    setPayload(data);
}

/** The payload the consent screen should render, if any. */
export function peekDeepLinkPayload(): string | null {
    return getPayload();
}

/** Is there a deep link waiting to be consented to? */
export function hasDeepLink(): boolean {
    return getPayload() !== null;
}

/** Clear the payload once the consent screen has shown it. */
export function clearDeepLinkFlow(): void {
    clearPayload();
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
    clearPayload();
    clearAuthenticated();
}
