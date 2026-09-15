import { beforeEach, describe, expect, it, vi } from "vitest";

import {
    beginAuthPrompt,
    clearDeepLinkFlow,
    endAuthPrompt,
    isAuthPromptInFlight,
    isDeepLinkFlowActive,
    isDuplicateDelivery,
    isWalletAuthenticated,
    markDeepLinkPending,
    markDeepLinkReady,
    markWalletAuthenticated,
    peekDeepLinkPayload,
    promotePendingDeepLink,
    resetAuthSession,
    shouldAbortStaleContinuation,
} from "./deepLinkFlow";

/**
 * Minimal sessionStorage stand-in — the module is deliberately storage-backed
 * so that state survives the full-page navigations the wallet performs.
 */
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
        this.map.set(key, value);
    }
}

const AUTH_PAYLOAD = {
    type: "auth",
    session: "sess-1",
    platform: "example",
    redirect: "https://example.com/cb",
};

beforeEach(() => {
    vi.stubGlobal("sessionStorage", new MemoryStorage());
});

describe("deep link flow state", () => {
    it("reports an active flow for a payload awaiting authentication", () => {
        expect(isDeepLinkFlowActive()).toBe(false);
        markDeepLinkPending(AUTH_PAYLOAD);
        expect(isDeepLinkFlowActive()).toBe(true);
        expect(JSON.parse(peekDeepLinkPayload() as string)).toEqual(
            AUTH_PAYLOAD,
        );
    });

    it("never hides the payload during the pending -> ready handover", () => {
        // The promotion renames the key the payload lives under. It must not
        // be observable as "no deep link" at any point in between, or code
        // running concurrently with authentication concludes the request has
        // gone away. This holds because promote writes the new key before
        // removing the old one, and readers check both.
        markDeepLinkPending(AUTH_PAYLOAD);

        expect(promotePendingDeepLink()).toBe(true);

        expect(sessionStorage.getItem("pendingDeepLink")).toBeNull();
        expect(sessionStorage.getItem("deepLinkData")).not.toBeNull();
        expect(isDeepLinkFlowActive()).toBe(true);
        expect(JSON.parse(peekDeepLinkPayload() as string)).toEqual(
            AUTH_PAYLOAD,
        );
    });

    it("reports no active flow once the payload has been consumed", () => {
        // Regression: a sticky "flow active" marker used to outlive the
        // payload, so a login the user had already completed kept being
        // offered back to them on /login as a pending request.
        markDeepLinkPending(AUTH_PAYLOAD);
        promotePendingDeepLink();
        expect(isDeepLinkFlowActive()).toBe(true);

        clearDeepLinkFlow();

        expect(isDeepLinkFlowActive()).toBe(false);
        expect(peekDeepLinkPayload()).toBeNull();
        expect(sessionStorage.getItem("deepLinkFlowActive")).toBeNull();
    });

    it("treats a payload that arrives post-authentication as active", () => {
        markDeepLinkReady(AUTH_PAYLOAD);
        expect(isDeepLinkFlowActive()).toBe(true);
        expect(sessionStorage.getItem("pendingDeepLink")).toBeNull();
    });

    it("has nothing to promote when no payload is pending", () => {
        expect(promotePendingDeepLink()).toBe(false);
        expect(isDeepLinkFlowActive()).toBe(false);
    });

    it("clears every key once the consent drawer has consumed the payload", () => {
        markDeepLinkPending(AUTH_PAYLOAD);
        promotePendingDeepLink();

        clearDeepLinkFlow();

        expect(isDeepLinkFlowActive()).toBe(false);
        expect(peekDeepLinkPayload()).toBeNull();
    });

    it("survives a pending payload being overwritten by a newer one", () => {
        markDeepLinkPending(AUTH_PAYLOAD);
        const newer = { ...AUTH_PAYLOAD, session: "sess-2" };
        markDeepLinkPending(newer);

        promotePendingDeepLink();
        expect(JSON.parse(peekDeepLinkPayload() as string)).toEqual(newer);
    });
});

describe("authentication signals", () => {
    it("records that the user got through authentication", () => {
        expect(isWalletAuthenticated()).toBe(false);
        markWalletAuthenticated();
        expect(isWalletAuthenticated()).toBe(true);
    });

    it("brackets an in-flight prompt so the layout defers navigation", () => {
        expect(isAuthPromptInFlight()).toBe(false);
        beginAuthPrompt();
        expect(isAuthPromptInFlight()).toBe(true);
        endAuthPrompt();
        expect(isAuthPromptInFlight()).toBe(false);
    });

    it("is safe to end a prompt that was never begun", () => {
        expect(() => endAuthPrompt()).not.toThrow();
        expect(isAuthPromptInFlight()).toBe(false);
    });
});

describe("cold-start orderings", () => {
    /**
     * Each case walks one interleaving of the four concurrent actors and
     * asserts the user ends up at the consent screen. The fix is only correct
     * if EVERY ordering lands there — the previous implementations worked for
     * the slow ordering and dropped the payload on the fast one.
     */

    it("URL arrives, then the user authenticates (slow biometric)", () => {
        markDeepLinkPending(AUTH_PAYLOAD);

        // Splash sees an active flow, so it defers to /login rather than
        // running a second competing authenticate() call.
        expect(isDeepLinkFlowActive()).toBe(true);

        beginAuthPrompt();
        endAuthPrompt();
        markWalletAuthenticated();
        promotePendingDeepLink();

        expect(peekDeepLinkPayload()).not.toBeNull();
    });

    it("URL arrives while the biometric prompt is already on screen (fast auth)", () => {
        // Splash starts its prompt before the cold-start URL is delivered.
        beginAuthPrompt();

        // The URL lands mid-prompt. The layout must park it and NOT navigate,
        // because the post-auth routine owns routing from here.
        markDeepLinkPending(AUTH_PAYLOAD);
        expect(isAuthPromptInFlight()).toBe(true);

        // Auth succeeds; the post-auth routine collects the parked payload.
        endAuthPrompt();
        markWalletAuthenticated();
        expect(promotePendingDeepLink()).toBe(true);
        expect(peekDeepLinkPayload()).not.toBeNull();
    });

    it("URL arrives after authentication already completed", () => {
        beginAuthPrompt();
        endAuthPrompt();
        markWalletAuthenticated();

        // Nothing was pending at auth time, so the post-auth routine routed to
        // /main. The late URL must still reach the consent screen: the layout
        // sees an authenticated session and marks the payload ready directly.
        expect(promotePendingDeepLink()).toBe(false);

        markDeepLinkReady(AUTH_PAYLOAD);
        expect(isWalletAuthenticated()).toBe(true);
        expect(peekDeepLinkPayload()).not.toBeNull();
    });
});

describe("duplicate delivery guard", () => {
    it("collapses the double delivery of one cold-start URL", () => {
        const url = "w3ds://auth?session=sess-1&platform=example";
        expect(isDuplicateDelivery(url)).toBe(false);
        expect(isDuplicateDelivery(url)).toBe(true);
    });

    it("does not suppress a different URL", () => {
        expect(isDuplicateDelivery("w3ds://auth?session=a")).toBe(false);
        expect(isDuplicateDelivery("w3ds://auth?session=b")).toBe(false);
    });

    it("keeps suppressing a handled URL after the flow is consumed", () => {
        // Regression: releasing the guard on clearDeepLinkFlow re-armed the
        // loop it exists to stop. /scan-qr consumes the payload and clears the
        // flow, and Android (singleTask) keeps replaying the original intent
        // from getCurrent(), so a released guard let the same login restart
        // over and over.
        const url = "w3ds://auth?session=sess-1&platform=example";
        expect(isDuplicateDelivery(url)).toBe(false);
        expect(isDuplicateDelivery(url)).toBe(true);

        clearDeepLinkFlow();

        expect(isDuplicateDelivery(url)).toBe(true);
    });

    it("still accepts a genuinely new request after one is consumed", () => {
        // The guard keys on the whole URL, and the platform mints a fresh
        // `session` uuid per request, so a real second login is never
        // mistaken for a replay of the first.
        const first = "w3ds://auth?session=sess-1&platform=example";
        const second = "w3ds://auth?session=sess-2&platform=example";

        expect(isDuplicateDelivery(first)).toBe(false);
        clearDeepLinkFlow();

        expect(isDuplicateDelivery(second)).toBe(false);
    });
});

describe("logout", () => {
    it("clears the authenticated marker so later deep links go to login", () => {
        // Regression: logout is an SPA navigation, so sessionStorage survives
        // it. A stale walletAuthenticated made the deep-link router treat the
        // logged-out session as authenticated.
        markWalletAuthenticated();
        markDeepLinkReady(AUTH_PAYLOAD);

        resetAuthSession();

        expect(isWalletAuthenticated()).toBe(false);
        expect(isDeepLinkFlowActive()).toBe(false);
        expect(peekDeepLinkPayload()).toBeNull();
    });

    it("clears a prompt bracket left open by an interrupted login", () => {
        beginAuthPrompt();
        resetAuthSession();
        expect(isAuthPromptInFlight()).toBe(false);
    });
});

describe("post-auth handover", () => {
    /**
     * The handover in continueAfterSuccessfulAuth must be atomic: collect the
     * payload, THEN release the prompt bracket, with no await in between.
     * These cases model the two interleavings either side of that block and
     * assert that exactly one actor is responsible for navigating in each.
     */

    it("collects a payload parked during the post-auth awaits", () => {
        beginAuthPrompt();

        // Auth succeeded; the routine is in its vault-read awaits. A URL
        // lands. The bracket is still open, so the layout parks it rather than
        // navigating.
        markWalletAuthenticated();
        markDeepLinkPending(AUTH_PAYLOAD);
        expect(isAuthPromptInFlight()).toBe(true);

        // Handover block: collect first...
        promotePendingDeepLink();
        const hasPending = isDeepLinkFlowActive() && !!peekDeepLinkPayload();
        // ...then release.
        endAuthPrompt();

        expect(hasPending).toBe(true);
    });

    it("leaves a URL arriving after the handover to the layout", () => {
        beginAuthPrompt();
        markWalletAuthenticated();

        // Handover runs with nothing pending, so the routine heads for /main.
        promotePendingDeepLink();
        const hasPending = isDeepLinkFlowActive() && !!peekDeepLinkPayload();
        endAuthPrompt();
        expect(hasPending).toBe(false);

        // The URL lands just after. The bracket is closed and the session is
        // authenticated, so the layout routes it to the consent screen itself
        // — nobody is waiting on a payload that never arrives.
        markDeepLinkReady(AUTH_PAYLOAD);
        expect(isAuthPromptInFlight()).toBe(false);
        expect(isWalletAuthenticated()).toBe(true);
        expect(peekDeepLinkPayload()).not.toBeNull();
    });

    it("is safe for the caller to close an already-released bracket", () => {
        // Callers close the bracket in a finally block; on the success path
        // continueAfterSuccessfulAuth has already done it.
        beginAuthPrompt();
        endAuthPrompt();
        expect(() => endAuthPrompt()).not.toThrow();
        expect(isAuthPromptInFlight()).toBe(false);
    });
});

describe("superseded splash/login continuation", () => {
    // An async onMount is not cancelled when its component unmounts. The
    // splash sleeps 1.2s and then awaits storage, so on a cold start it is
    // still suspended while the user authenticates and the consent drawer
    // opens. Both screens guard their continuations with a liveness check
    // that asks this module whether the user is already through the gate.
    // Bind to the real exported guard, not a local re-statement of it, so
    // deleting the guard from the app breaks these tests.
    const stillOwnsTheScreen = (destroyed: boolean) =>
        !shouldAbortStaleContinuation(destroyed);

    it("tells a still-mounted splash it may proceed", () => {
        expect(stillOwnsTheScreen(false)).toBe(true);
    });

    it("stops a splash that woke up after authentication completed", () => {
        // This is the reported bug: the consent drawer is on screen, then the
        // splash's parked continuation resumes and navigates away from it.
        markWalletAuthenticated();

        expect(stillOwnsTheScreen(false)).toBe(false);
    });

    it("stops a splash that woke up after being unmounted", () => {
        expect(stillOwnsTheScreen(true)).toBe(false);
    });

    it("keeps the payload intact when a stale continuation is abandoned", () => {
        // Bailing out must not disturb the flow the live screen is running.
        markDeepLinkPending(AUTH_PAYLOAD);
        markWalletAuthenticated();

        expect(stillOwnsTheScreen(false)).toBe(false);
        expect(isDeepLinkFlowActive()).toBe(true);
        expect(peekDeepLinkPayload()).toBe(JSON.stringify(AUTH_PAYLOAD));
    });
});
