import { browser } from "$app/environment";
import { writable } from "svelte/store";

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

export function logout(): void {
    sessionToken.set(null);
}
