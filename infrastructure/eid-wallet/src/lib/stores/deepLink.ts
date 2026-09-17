/**
 * Storage for the deep-link login flow. This module is just state; the
 * routing decisions that use it live in lib/utils/deepLinkFlow.ts.
 *
 * ONE payload slot, not a pending/ready pair. A deep link is either present
 * or it is not; whether it may be ACTED on is answered by the authenticated
 * flag, which every consumer checks anyway. Two slots meant a copy step whose
 * only job was to relabel a payload that had not changed, and readers that
 * had to consult both and fall back.
 *
 * Deliberately sessionStorage rather than a Svelte store or localStorage:
 *
 *  - A Svelte store is in-memory, and this state has to survive the full-page
 *    navigations the wallet performs between the splash, /login and /scan-qr.
 *    An in-memory store would be empty on the other side.
 *  - localStorage would survive the app being killed, which is exactly wrong
 *    for `walletAuthenticated`: a deep link arriving after a cold start must
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

/** Record that the user is through the authentication gate this session. */
export function setAuthenticated(): void {
    store()?.setItem(AUTHED_KEY, "true");
}

export function getAuthenticated(): boolean {
    return store()?.getItem(AUTHED_KEY) === "true";
}

export function clearAuthenticated(): void {
    store()?.removeItem(AUTHED_KEY);
}

export function setPayload(data: unknown): void {
    store()?.setItem(PAYLOAD_KEY, JSON.stringify(data));
}

export function getPayload(): string | null {
    return store()?.getItem(PAYLOAD_KEY) ?? null;
}

export function clearPayload(): void {
    store()?.removeItem(PAYLOAD_KEY);
}
