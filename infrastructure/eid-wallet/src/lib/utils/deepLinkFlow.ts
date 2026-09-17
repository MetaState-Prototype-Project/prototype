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
 * Whoever finishes LAST owns the routing. That is the whole design:
 *
 *   - URL arrives while unauthenticated -> park it, route nothing.
 *   - Authentication completes -> check for a parked URL and route to it.
 *   - URL arrives while already authenticated -> route to it immediately.
 *
 * Both sides check the same two facts, so neither can act on a half-finished
 * picture. The bug this replaces came from the layout inferring "is the user
 * authenticated?" from `window.location.pathname` at the instant of delivery:
 * on a cold start the path is "/" for the splash regardless of how the race
 * went, so a user who had ALREADY authenticated was still classified as
 * logged out. The payload was parked for a screen that had finished running,
 * and the user landed on /main with the consent screen never shown.
 *
 * Authentication state is therefore recorded EXPLICITLY, by the code that
 * performs the authentication, and never derived from the URL.
 */

import {
    clearAuthenticated,
    clearPayloads,
    getAuthenticated,
    getPendingPayload,
    getReadyPayload,
    promotePayload,
    setAuthenticated,
    setPendingPayload,
    setReadyPayload,
} from "$lib/stores/deepLink";

/**
 * Record that the user is through the authentication gate.
 *
 * Callers must do this BEFORE any await that precedes their navigation, so a
 * deep link delivered mid-flight sees the user as authenticated and routes
 * itself rather than parking a payload nobody is left to collect.
 */
export function markWalletAuthenticated(): void {
    setAuthenticated();
}

export function isWalletAuthenticated(): boolean {
    return getAuthenticated();
}

/**
 * Park a payload that arrived before the user finished authenticating.
 * Whoever completes authentication collects it.
 */
export function markDeepLinkPending(data: unknown): void {
    setPendingPayload(data);
}

/** Hand a payload directly to /scan-qr: the user is already authenticated. */
export function markDeepLinkReady(data: unknown): void {
    setReadyPayload(data);
}

/**
 * Promote a parked payload to a ready one. Called at the end of every
 * authentication path (biometric on the splash, PIN on /login).
 *
 * Returns true if there was something to promote, which is the caller's
 * signal to route to /scan-qr instead of /main.
 */
export function promotePendingDeepLink(): boolean {
    return promotePayload();
}

/** The payload /scan-qr should render, from either delivery path. */
export function peekDeepLinkPayload(): string | null {
    return getReadyPayload() ?? getPendingPayload();
}

/** Clear the payload once the consent screen has been shown. */
export function clearDeepLinkFlow(): void {
    clearPayloads();
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
    clearPayloads();
    clearAuthenticated();
}
