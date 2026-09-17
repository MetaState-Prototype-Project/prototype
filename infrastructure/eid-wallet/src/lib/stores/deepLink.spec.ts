import { beforeEach, describe, expect, it, vi } from "vitest";

import {
    clearDeepLink,
    hasDeepLink,
    isAuthenticatedForDeepLink,
    markAuthenticatedForDeepLink,
    peekDeepLink,
    resetDeepLinkAuthSession,
    storeDeepLink,
} from "./deepLink";

/** Minimal sessionStorage stand-in; the module is deliberately storage-backed. */
class MemoryStorage implements Storage {
    private map = new Map<string, string>();
    get length() {
        return this.map.size;
    }
    clear() {
        this.map.clear();
    }
    getItem(key: string) {
        return this.map.get(key) ?? null;
    }
    key(index: number) {
        return Array.from(this.map.keys())[index] ?? null;
    }
    removeItem(key: string) {
        this.map.delete(key);
    }
    setItem(key: string, value: string) {
        this.map.set(key, String(value));
    }
}

beforeEach(() => {
    vi.stubGlobal("sessionStorage", new MemoryStorage());
});

const PAYLOAD = {
    type: "auth",
    session: "21fcc8a5",
    platform: "pictique",
    redirect: "https://pictique.example/api/auth",
};

/**
 * The layout's routing decision, mirrored from routeDeepLink() in
 * routes/+layout.svelte. Returns where the layout sends the user, or null when
 * it parks the payload and routes nothing.
 */
function layoutRouteDeepLink(): "/scan-qr" | null {
    storeDeepLink(PAYLOAD);
    if (!isAuthenticatedForDeepLink()) return null;
    return "/scan-qr";
}

/**
 * The tail of continueAfterSuccessfulAuth(), which every authentication path
 * (biometric on the splash, PIN on /login) funnels through.
 */
function completeAuthentication(): "/scan-qr" | "/main" {
    markAuthenticatedForDeepLink();
    return hasDeepLink() ? "/scan-qr" : "/main";
}

/** What /scan-qr finds on mount: a payload to consent to, or nothing. */
function scanQrSeesPayload(): boolean {
    return peekDeepLink() !== null;
}

describe("deep-link login rendezvous", () => {
    /**
     * THE ORIGINAL BUG. Biometrics succeed before the deep-link plugin has
     * finished loading, so authentication completes first and the URL lands
     * afterwards. The old code inferred auth from window.location.pathname,
     * which is "/" on the splash either way, so this ordering was misread as
     * "logged out": the payload was parked for a screen that had already
     * finished and the user was dropped on /main.
     */
    it("routes to consent when authentication WINS the race", () => {
        const authDestination = completeAuthentication();
        expect(authDestination).toBe("/main");

        const layoutDestination = layoutRouteDeepLink();

        expect(layoutDestination).toBe("/scan-qr");
        expect(scanQrSeesPayload()).toBe(true);
    });

    /**
     * The slow-authentication ordering: the URL arrives while the user is
     * still on the sensor. The layout parks it and routes nothing, then the
     * authentication path collects it.
     */
    it("routes to consent when the deep link WINS the race", () => {
        const layoutDestination = layoutRouteDeepLink();
        expect(layoutDestination).toBeNull();

        const authDestination = completeAuthentication();

        expect(authDestination).toBe("/scan-qr");
        expect(scanQrSeesPayload()).toBe(true);
    });

    it("sends a plain launch to /main, with no payload to consent to", () => {
        expect(completeAuthentication()).toBe("/main");
        expect(scanQrSeesPayload()).toBe(false);
    });

    it("routes an already-authenticated user straight to consent", () => {
        completeAuthentication();
        expect(layoutRouteDeepLink()).toBe("/scan-qr");
        expect(scanQrSeesPayload()).toBe(true);
    });

    it("keeps the payload readable until the consent screen clears it", () => {
        layoutRouteDeepLink();
        completeAuthentication();
        expect(scanQrSeesPayload()).toBe(true);

        clearDeepLink();
        expect(scanQrSeesPayload()).toBe(false);
    });

    it("does not resurrect a payload the consent screen already consumed", () => {
        layoutRouteDeepLink();
        expect(completeAuthentication()).toBe("/scan-qr");
        clearDeepLink();

        expect(completeAuthentication()).toBe("/main");
    });

    /**
     * Retrying a login the user declined must work. Platforms mint one
     * `session` per offer, so the retry URL is byte-identical; nothing here
     * may treat a repeat as permanently spent.
     */
    it("lets the same URL be presented again after it was dismissed", () => {
        layoutRouteDeepLink();
        completeAuthentication();
        clearDeepLink();

        expect(layoutRouteDeepLink()).toBe("/scan-qr");
        expect(scanQrSeesPayload()).toBe(true);
    });

    /**
     * Logout does an SPA navigation to "/", which leaves sessionStorage
     * intact. Without resetDeepLinkAuthSession() the session would keep claiming the
     * user is authenticated and the next deep link would skip the gate.
     */
    it("forgets authentication on logout so the next link re-prompts", () => {
        completeAuthentication();
        expect(isAuthenticatedForDeepLink()).toBe(true);

        resetDeepLinkAuthSession();

        expect(isAuthenticatedForDeepLink()).toBe(false);
        expect(layoutRouteDeepLink()).toBeNull();
    });

    it("survives storage being unavailable without throwing", () => {
        vi.stubGlobal("sessionStorage", undefined);

        expect(() => layoutRouteDeepLink()).not.toThrow();
        expect(() => completeAuthentication()).not.toThrow();
        expect(peekDeepLink()).toBeNull();
    });
});
