import { beforeEach, describe, expect, it, vi } from "vitest";

import {
    beginAuthPrompt,
    claimSplashAuthOwnership,
    clearDeepLinkAcknowledged,
    clearDeepLinkFlow,
    endAuthPrompt,
    isAuthPromptInFlight,
    isDeepLinkFlowActive,
    isDuplicateDelivery,
    isWalletAuthenticated,
    markDeepLinkCompleted,
    markDeepLinkHandled,
    markDeepLinkPending,
    markDeepLinkReady,
    markWalletAuthenticated,
    peekDeepLinkPayload,
    promotePendingDeepLink,
    releaseSplashAuthOwnership,
    resetAuthSession,
    shouldAbortStaleContinuation,
    shouldRedirectToLogin,
    takeCompletedDeepLink,
    wasDeepLinkJustAcknowledged,
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
    vi.stubGlobal("localStorage", new MemoryStorage());
});

/**
 * Simulate Android reloading the webview while the app sits in the background
 * (which happens when a deep-link login hands off to the browser via openUrl).
 * sessionStorage does not survive that; localStorage does.
 */
function reloadWebview() {
    vi.stubGlobal("sessionStorage", new MemoryStorage());
}

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

        // The splash stays mounted and owns the prompt even when a deep link
        // is pending, so that a deep-link launch still gets biometrics.
        expect(isDeepLinkFlowActive()).toBe(true);
        claimSplashAuthOwnership();
        expect(shouldRedirectToLogin()).toBe(false);

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

        markDeepLinkHandled();

        expect(isDuplicateDelivery(url)).toBe(true);
    });

    it("suppresses a replay even if the flow is cleared after one delivery", () => {
        // The duplicate may arrive AFTER /scan-qr has already consumed the
        // payload. Clearing must therefore remember the URL as handled rather
        // than forget it, or the replay restarts the login.
        const url = "w3ds://auth?session=sess-1&platform=example";
        expect(isDuplicateDelivery(url)).toBe(false);

        markDeepLinkHandled();

        expect(isDuplicateDelivery(url)).toBe(true);
    });

    it("forgets handled URLs on logout so the same link works again", () => {
        // Logging out and back in with a link the user was previously sent is
        // a legitimate new request, and the session is torn down anyway.
        const url = "w3ds://auth?session=sess-1&platform=example";
        expect(isDuplicateDelivery(url)).toBe(false);
        markDeepLinkHandled();
        expect(isDuplicateDelivery(url)).toBe(true);

        resetAuthSession();

        expect(isDuplicateDelivery(url)).toBe(false);
    });

    it("still accepts a genuinely new request after one is consumed", () => {
        // The guard keys on the whole URL, and the platform mints a fresh
        // `session` uuid per request, so a real second login is never
        // mistaken for a replay of the first.
        const first = "w3ds://auth?session=sess-1&platform=example";
        const second = "w3ds://auth?session=sess-2&platform=example";

        expect(isDuplicateDelivery(first)).toBe(false);
        markDeepLinkHandled();

        expect(isDuplicateDelivery(second)).toBe(false);
    });

    it("still suppresses a replay after the webview reloads in the background", () => {
        // The warm-resume bug: completing a deep-link login sends the user out
        // to the browser via openUrl, and Android may reload the backgrounded
        // webview. The Activity is singleTask and keeps replaying the original
        // intent from getCurrent(), so a marker that died with the webview let
        // the finished login start all over again — ending on the PIN screen.
        const url = "w3ds://auth?session=sess-1&platform=example";
        expect(isDuplicateDelivery(url)).toBe(false);
        markDeepLinkHandled();

        reloadWebview();

        expect(isDuplicateDelivery(url)).toBe(true);
    });

    it("honours the same URL again once the replay window has passed", () => {
        // Regression, and the reason deep-link login stopped working entirely:
        // handled URLs used to be remembered FOREVER, on the false assumption
        // that every request carries a unique session. A session belongs to an
        // offer and the same offer URI is reused while its QR is displayed, so
        // a permanent marker blacklisted real retries and the approval screen
        // never appeared again.
        vi.useFakeTimers();
        try {
            const url = "w3ds://auth?session=sess-1&platform=example";
            expect(isDuplicateDelivery(url)).toBe(false);
            markDeepLinkHandled();
            reloadWebview();
            expect(isDuplicateDelivery(url)).toBe(true);

            vi.advanceTimersByTime(31_000);
            reloadWebview();

            expect(isDuplicateDelivery(url)).toBe(false);
        } finally {
            vi.useRealTimers();
        }
    });

    it("does not strand a URL when the app dies mid-request", () => {
        // The user opens a link, the consent screen appears, and the app is
        // killed before they confirm. The request never completed, so nothing
        // promoted it to "handled" — and the in-flight marker must not survive
        // to block the very same link on the next launch, or that login is
        // permanently unreachable.
        const url = "w3ds://auth?session=sess-1&platform=example";
        expect(isDuplicateDelivery(url)).toBe(false);

        reloadWebview();

        expect(isDuplicateDelivery(url)).toBe(false);
    });

    it("lets a rebuilt webview reopen a request the user has not answered", () => {
        // THE Activity-recreate case. Following a w3ds link from the browser
        // restarts the Activity, so Tauri builds a fresh webview and the plugin
        // replays the original intent via getCurrent(). The consent drawer had
        // been SHOWN but not answered, so that replay is the only delivery the
        // new webview will ever get and must be honoured — otherwise the user
        // watches the request appear and then vanish into the camera page.
        const url = "w3ds://auth?session=sess-1&platform=example";
        expect(isDuplicateDelivery(url)).toBe(false);

        // Drawer took ownership of the payload; the user has NOT decided yet.
        clearDeepLinkFlow();

        reloadWebview();

        expect(isDuplicateDelivery(url)).toBe(false);
    });
});

describe("authentication is deliberately NOT durable", () => {
    it("keeps the post-login confirmation across an app restart", () => {
        // Approving calls openUrl, which leaves the app; coming back from the
        // browser often restarts the Activity and destroys the webview. The
        // drawer state is an in-memory Svelte store, so without this the user
        // returned to a bare scanner page instead of "You're logged in!".
        markDeepLinkCompleted({
            platform: "pictique",
            hostname: "pictique.w3ds.metastate.foundation",
            redirect: "https://pictique.w3ds.metastate.foundation/api/auth",
        });

        reloadWebview();

        // Every field the drawer renders must survive, not just the name: the
        // app icon is resolved from the hostname, so a name-only restore came
        // back with a blank logo.
        expect(takeCompletedDeepLink()).toEqual({
            platform: "pictique",
            hostname: "pictique.w3ds.metastate.foundation",
            redirect: "https://pictique.w3ds.metastate.foundation/api/auth",
        });
    });

    it("only hands the confirmation over once", () => {
        markDeepLinkCompleted({ platform: "pictique" });

        expect(takeCompletedDeepLink()).toEqual({
            platform: "pictique",
            hostname: null,
            redirect: null,
        });
        expect(takeCompletedDeepLink()).toBeNull();
    });

    it("reports no confirmation when none is pending", () => {
        expect(takeCompletedDeepLink()).toBeNull();
    });

    it("forgets the authenticated session when the webview reloads", () => {
        // Security boundary. walletAuthenticated must not be persisted: the
        // deep-link router and the splash both treat an authenticated session
        // as already through the gate, so a durable marker would let a link
        // arriving after an app kill skip authentication entirely.
        markWalletAuthenticated();
        expect(isWalletAuthenticated()).toBe(true);

        reloadWebview();

        expect(isWalletAuthenticated()).toBe(false);
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
    // Screens snapshot the auth state when their routine starts and pass it
    // back in, so the guard can tell a TRANSITION from a screen that simply
    // mounted while already authenticated.
    const stillOwnsTheScreen = (destroyed: boolean, authedAtStart = false) =>
        !shouldAbortStaleContinuation(destroyed, authedAtStart);

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

    it("lets a screen that mounted already-authenticated keep running", () => {
        // Regression: /login is reached WITH an authenticated session during a
        // deep-link flow (auth completes, then a guard bounces here). Treating
        // that as a stale continuation made it return before prompting, so the
        // biometric prompt never appeared and only the PIN pad was offered.
        markWalletAuthenticated();

        expect(stillOwnsTheScreen(false, true)).toBe(true);
    });

    it("still stops that screen once it is unmounted", () => {
        markWalletAuthenticated();

        expect(stillOwnsTheScreen(true, true)).toBe(false);
    });
});

describe("single biometric prompt site", () => {
    // The biometric dialog used to be fired from BOTH the splash and /login.
    // Both screens prompted on mount, so whichever won the race decided which
    // backdrop the system dialog appeared over. The splash is now the only
    // prompt site, which means the deep-link handler must stop navigating away
    // from whoever owns that prompt.

    it("keeps a deep-link launch on the splash so it still gets biometrics", () => {
        // The handler used to goto("/login") the moment a cold-start URL was
        // parked. That unmounted the splash before it could prompt, so a
        // deep-link launch was PIN-only by construction.
        markDeepLinkPending(AUTH_PAYLOAD);
        claimSplashAuthOwnership();

        expect(shouldRedirectToLogin(false)).toBe(false);
    });

    it("does not navigate while a prompt is on screen", () => {
        beginAuthPrompt();

        expect(shouldRedirectToLogin(true, false)).toBe(false);
    });

    it("still routes to login when no screen owns the prompt", () => {
        // Without this the payload would be parked with nobody to collect it.
        expect(shouldRedirectToLogin(false, false)).toBe(true);
    });

    it("reads the live claims when none are supplied", () => {
        expect(shouldRedirectToLogin()).toBe(true);

        claimSplashAuthOwnership();
        expect(shouldRedirectToLogin()).toBe(false);
        releaseSplashAuthOwnership();
        expect(shouldRedirectToLogin()).toBe(true);

        beginAuthPrompt();
        expect(shouldRedirectToLogin()).toBe(false);
        endAuthPrompt();
        expect(shouldRedirectToLogin()).toBe(true);
    });

    it("keeps the launch on the splash during its intro animation", () => {
        // THE cold-start case, and the one the pathname check hid. The deep
        // link is delivered from the root layout's onMount, which runs while
        // the splash is still playing its ~1.2s intro — long before it reaches
        // the biometric prompt.
        //
        // The splash therefore claims ownership at component INIT, not when it
        // is finally ready to authenticate. Claiming late left a window of
        // over a second in which the URL saw no owner, so the handler
        // navigated to /login and unmounted the splash before it could prompt.
        // Since /login is PIN-only, the user got the PIN pad instead of
        // biometrics and the payload was left for a screen that never routes
        // it.
        claimSplashAuthOwnership();

        // Delivery lands mid-intro: no prompt is on screen yet.
        markDeepLinkPending(AUTH_PAYLOAD);

        expect(isAuthPromptInFlight()).toBe(false);
        expect(shouldRedirectToLogin()).toBe(false);
    });

    it("routes a URL re-delivered after the splash finished its handover", () => {
        // THE regression that made the consent screen vanish on fast
        // authentication, and the reason ownership cannot be a pathname check.
        //
        // The splash authenticates, continueAfterSuccessfulAuth collects the
        // payload, releases the prompt bracket and calls goto("/scan-qr").
        // SvelteKit navigation is async, so location.pathname is STILL "/"
        // while that goto is in flight. A duplicate delivery landing in that
        // window used to see path "/" and defer to an owner that had already
        // finished, leaving the payload parked with nobody to collect it.
        claimSplashAuthOwnership();
        beginAuthPrompt();

        // Handover completes and the splash hands off.
        markWalletAuthenticated();
        endAuthPrompt();
        releaseSplashAuthOwnership();

        // The re-delivered URL must now be routed, not deferred, even though
        // the pathname has not caught up yet.
        expect(shouldRedirectToLogin()).toBe(true);
    });

    it("releases ownership when the user declines biometrics", () => {
        // The splash falls through to /login on cancel. If the claim leaked,
        // every later deep link would defer to a screen that is gone.
        claimSplashAuthOwnership();
        releaseSplashAuthOwnership();

        expect(shouldRedirectToLogin()).toBe(true);
    });

    it("forgets a leaked ownership claim on logout", () => {
        claimSplashAuthOwnership();

        resetAuthSession();

        expect(shouldRedirectToLogin()).toBe(true);
    });
});

describe("acknowledged confirmation", () => {
    // Approving a login calls openUrl, which restarts the Activity. If the
    // user taps Ok inside the short window BEFORE that restart lands, the
    // rebuilt webview reloads /scan-qr with the payload suppressed and the
    // confirmation already consumed. It then saw "no deep link" and opened the
    // camera — a scanner the user never asked for.

    it("suppresses the scanner after the user dismisses the confirmation", () => {
        markDeepLinkCompleted({ platform: "pictique", hostname: "p.example" });

        // The user taps Ok before the restart lands.
        expect(takeCompletedDeepLink(true)).not.toBeNull();

        // The rebuilt webview finds nothing to show and must NOT start the
        // camera.
        expect(takeCompletedDeepLink()).toBeNull();
        expect(wasDeepLinkJustAcknowledged()).toBe(true);
    });

    it("does not suppress the scanner merely for rendering the confirmation", () => {
        markDeepLinkCompleted({ platform: "pictique", hostname: "p.example" });

        // Restoring the card after a restart is not a dismissal: the user has
        // not answered yet, so a later genuine scan must still work.
        expect(takeCompletedDeepLink()).not.toBeNull();

        expect(wasDeepLinkJustAcknowledged()).toBe(false);
    });

    it("records the dismissal even when the card was already restored", () => {
        // The restore path consumes the record when it RENDERS, so by the time
        // Ok is tapped there is nothing left to take. The acknowledgement must
        // still be written or the restart reopens the camera.
        markDeepLinkCompleted({ platform: "pictique", hostname: "p.example" });
        takeCompletedDeepLink();

        expect(takeCompletedDeepLink(true)).toBeNull();

        expect(wasDeepLinkJustAcknowledged()).toBe(true);
    });

    it("lets the user open the scanner deliberately right after", () => {
        markDeepLinkCompleted({ platform: "pictique", hostname: "p.example" });
        takeCompletedDeepLink(true);

        // Tapping Scan is an in-app navigation, which proves intent. Without
        // this the user would be bounced back to /main for 30 seconds.
        clearDeepLinkAcknowledged();

        expect(wasDeepLinkJustAcknowledged()).toBe(false);
    });

    it("expires so it can never suppress a later scan", () => {
        vi.useFakeTimers();
        try {
            markDeepLinkCompleted({
                platform: "pictique",
                hostname: "p.example",
            });
            takeCompletedDeepLink(true);
            expect(wasDeepLinkJustAcknowledged()).toBe(true);

            vi.advanceTimersByTime(31_000);

            expect(wasDeepLinkJustAcknowledged()).toBe(false);
        } finally {
            vi.useRealTimers();
        }
    });

    it("does not re-offer a finished login after a slow browser round-trip", () => {
        // Reported: approve in the wallet, spend a while on the platform in
        // Chrome, come back, tap Ok before the Activity restart lands — and
        // the consent drawer re-opened on the login just completed.
        //
        // HANDLED_AT is stamped at APPROVAL, before the openUrl handoff, the
        // time on the platform, and the restart on the way back. A leisurely
        // round-trip outlives the 30s replay window, so the replayed intent
        // was read as a genuine new request and the payload re-stored.
        vi.useFakeTimers();
        try {
            const url = "w3ds://auth?session=21fcc8a5&platform=pictique";
            expect(isDuplicateDelivery(url)).toBe(false);

            // User approves and is handed off to the browser.
            markDeepLinkHandled();
            markDeepLinkCompleted({ platform: "pictique" });

            // A slow round-trip: longer than the replay window.
            vi.advanceTimersByTime(45_000);

            // Back in the app, the user taps Ok on the confirmation.
            takeCompletedDeepLink(true);

            // The Activity restart lands now and replays the original intent.
            reloadWebview();

            expect(isDuplicateDelivery(url)).toBe(true);
        } finally {
            vi.useRealTimers();
        }
    });

    it("still honours a genuine retry long after the login was dismissed", () => {
        // The counterweight: refreshing the window at Ok must not resurrect a
        // permanent blacklist. The same offer URI is reused while its QR is on
        // screen, so presenting it again later is a real request.
        vi.useFakeTimers();
        try {
            const url = "w3ds://auth?session=21fcc8a5&platform=pictique";
            isDuplicateDelivery(url);
            markDeepLinkHandled();
            markDeepLinkCompleted({ platform: "pictique" });
            takeCompletedDeepLink(true);

            vi.advanceTimersByTime(31_000);
            reloadWebview();

            expect(isDuplicateDelivery(url)).toBe(false);
        } finally {
            vi.useRealTimers();
        }
    });

    it("forgets the acknowledgement on logout", () => {
        markDeepLinkCompleted({ platform: "pictique", hostname: "p.example" });
        takeCompletedDeepLink(true);

        resetAuthSession();

        expect(wasDeepLinkJustAcknowledged()).toBe(false);
    });
});
