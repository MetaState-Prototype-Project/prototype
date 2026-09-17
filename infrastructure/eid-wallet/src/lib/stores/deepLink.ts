/**
 * Storage for the deep-link login flow. This module is just state; the
 * routing decisions that use it live in lib/utils/deepLinkFlow.ts.
 *
 * Deliberately sessionStorage rather than a Svelte store or localStorage:
 *
 *  - A Svelte store is in-memory, and this state has to survive the
 *    full-page navigations the wallet performs between the splash, /login
 *    and /scan-qr. An in-memory store would be empty on the other side.
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

const PENDING_KEY = "pendingDeepLink";
const DATA_KEY = "deepLinkData";
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

/** A payload that arrived before the user finished authenticating. */
export function setPendingPayload(data: unknown): void {
    store()?.setItem(PENDING_KEY, JSON.stringify(data));
}

export function getPendingPayload(): string | null {
    return store()?.getItem(PENDING_KEY) ?? null;
}

/** A payload the consent screen can render right now. */
export function setReadyPayload(data: unknown): void {
    store()?.setItem(DATA_KEY, JSON.stringify(data));
}

export function getReadyPayload(): string | null {
    return store()?.getItem(DATA_KEY) ?? null;
}

/**
 * Move the parked payload to the ready slot verbatim.
 *
 * Deliberately a raw string copy: re-serialising would mean parsing a payload
 * this layer has no business interpreting, and would corrupt anything JSON
 * does not round-trip exactly.
 */
export function promotePayload(): boolean {
    const s = store();
    const pending = s?.getItem(PENDING_KEY);
    if (!pending) return false;
    s?.setItem(DATA_KEY, pending);
    s?.removeItem(PENDING_KEY);
    return true;
}

export function clearPayloads(): void {
    const s = store();
    s?.removeItem(PENDING_KEY);
    s?.removeItem(DATA_KEY);
}
