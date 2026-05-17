import { browser } from "$app/environment";
import { derived, writable } from "svelte/store";

const STORAGE_KEY = "aaas_session_token";

/** The W3DS portal session JWT, persisted in localStorage. */
export const sessionToken = writable<string | null>(
    browser ? localStorage.getItem(STORAGE_KEY) : null,
);

if (browser) {
    sessionToken.subscribe((token) => {
        if (token) localStorage.setItem(STORAGE_KEY, token);
        else localStorage.removeItem(STORAGE_KEY);
    });
}

export interface SessionClaims {
    ename: string;
    isAdmin: boolean;
}

/** Decodes the (unverified) JWT payload — fine for UI gating only. */
function decodeClaims(token: string | null): SessionClaims | null {
    if (!token) return null;
    try {
        const payload = JSON.parse(
            atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")),
        );
        return {
            ename: String(payload.ename ?? ""),
            isAdmin: payload.isAdmin === true,
        };
    } catch {
        return null;
    }
}

/** Claims of the logged-in user, or null. */
export const session = derived(sessionToken, ($t) => decodeClaims($t));

export function logout(): void {
    sessionToken.set(null);
}
