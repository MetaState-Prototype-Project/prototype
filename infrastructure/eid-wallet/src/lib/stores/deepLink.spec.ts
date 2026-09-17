import { beforeEach, describe, expect, it, vi } from "vitest";

import { goto } from "$app/navigation";
import type { GlobalState } from "$lib/global";
import { SessionController } from "$lib/global/controllers/session";
import {
    completeOnboarding,
    continueAfterSuccessfulAuth,
} from "$lib/utils/postLogin";
import { handleDeepLinkEvent, routeDeepLink } from "$lib/utils/routeDeepLink";
import { clearDeepLink, hasDeepLink, peekDeepLink } from "./deepLink";

vi.mock("$app/navigation", () => ({ goto: vi.fn(async () => {}) }));

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

let session: SessionController;
let globalState: GlobalState;

/**
 * The slice of GlobalState the two functions under test actually touch:
 * the session gate, plus the post-login chores, which are fire-and-forget and
 * must not influence routing. The vault rejects to prove that.
 */
function makeGlobalState(
    session: SessionController,
    onVaultRead: () => Promise<never> = async () => {
        throw new Error("no vault in tests");
    },
): GlobalState {
    return {
        isOnboardingComplete: false,
        sessionController: session,
        vaultController: {
            get vault() {
                return onVaultRead();
            },
        },
    } as unknown as GlobalState;
}

/** Events routeDeepLink() broadcast for an already-mounted /scan-qr. */
let dispatched: string[];
/** Listeners registered on the stubbed window, as the real one would hold. */
let listeners: ((event: Event) => void)[];
/** Stands in for goto() in handleDeepLinkEvent. */
let navigate: ReturnType<typeof vi.fn>;

beforeEach(() => {
    vi.stubGlobal("sessionStorage", new MemoryStorage());
    vi.mocked(goto).mockClear();
    dispatched = [];
    listeners = [];
    navigate = vi.fn(async () => {});
    // The node environment has no DOM; routeDeepLink() notifies a mounted
    // /scan-qr through window and reads the current path off window.location.
    vi.stubGlobal("window", {
        // Record the event, then deliver it to every listener, so a handler
        // that dispatches the event it listens for really does re-enter.
        dispatchEvent: (event: Event) => {
            dispatched.push(event.type);
            for (const listener of listeners) listener(event);
        },
        location: { pathname: "/" },
    });
    vi.stubGlobal(
        "CustomEvent",
        class {
            type: string;
            detail: unknown;
            constructor(type: string, init?: { detail?: unknown }) {
                this.type = type;
                this.detail = init?.detail;
            }
        },
    );
    session = new SessionController();
    globalState = makeGlobalState(session);
});

const PAYLOAD = {
    type: "auth",
    session: "21fcc8a5",
    platform: "pictique",
    redirect: "https://pictique.example/api/auth",
};

/**
 * The layout's half of the rendezvous, calling the shipped routeDeepLink().
 * Returns where the layout sent the user, or null when it parked the payload
 * and routed nothing.
 */
function layoutRouteDeepLink(): string | null {
    vi.mocked(goto).mockClear();
    routeDeepLink(globalState, PAYLOAD);
    return destinationFromGoto();
}

/**
 * The shipped continueAfterSuccessfulAuth(), which every authentication path
 * (biometric on the splash, PIN on /login) funnels through.
 */
async function completeAuthentication(): Promise<string | null> {
    vi.mocked(goto).mockClear();
    await continueAfterSuccessfulAuth(globalState);
    return destinationFromGoto();
}

/** Where the code under test navigated, if it navigated at all. */
function destinationFromGoto(): string | null {
    const calls = vi.mocked(goto).mock.calls;
    return calls.length ? String(calls[calls.length - 1][0]) : null;
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
    it("routes to consent when authentication WINS the race", async () => {
        const authDestination = await completeAuthentication();
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
    it("routes to consent when the deep link WINS the race", async () => {
        const layoutDestination = layoutRouteDeepLink();
        expect(layoutDestination).toBeNull();

        const authDestination = await completeAuthentication();

        expect(authDestination).toBe("/scan-qr");
        expect(scanQrSeesPayload()).toBe(true);
    });

    it("sends a plain launch to /main, with no payload to consent to", async () => {
        expect(await completeAuthentication()).toBe("/main");
        expect(scanQrSeesPayload()).toBe(false);
    });

    it("routes an already-authenticated user straight to consent", async () => {
        await completeAuthentication();
        expect(layoutRouteDeepLink()).toBe("/scan-qr");
        expect(scanQrSeesPayload()).toBe(true);
    });

    it("keeps the payload readable until the consent screen clears it", async () => {
        layoutRouteDeepLink();
        await completeAuthentication();
        expect(scanQrSeesPayload()).toBe(true);

        clearDeepLink();
        expect(scanQrSeesPayload()).toBe(false);
    });

    it("does not resurrect a payload the consent screen already consumed", async () => {
        layoutRouteDeepLink();
        expect(await completeAuthentication()).toBe("/scan-qr");
        clearDeepLink();

        expect(await completeAuthentication()).toBe("/main");
    });

    /**
     * Retrying a login the user declined must work. Platforms mint one
     * `session` per offer, so the retry URL is byte-identical; nothing here
     * may treat a repeat as permanently spent.
     */
    it("lets the same URL be presented again after it was dismissed", async () => {
        layoutRouteDeepLink();
        await completeAuthentication();
        clearDeepLink();

        expect(layoutRouteDeepLink()).toBe("/scan-qr");
        expect(scanQrSeesPayload()).toBe(true);
    });

    /**
     * Logout does an SPA navigation to "/", which leaves sessionStorage
     * intact. Without SessionController.clear() the session would keep claiming
     * the user is authenticated and the next deep link would skip the gate.
     */
    it("forgets authentication on logout so the next link re-prompts", async () => {
        await completeAuthentication();
        expect(session.isAuthenticated).toBe(true);

        // What GlobalState.reset() does on logout.
        await session.clear();
        clearDeepLink();

        expect(session.isAuthenticated).toBe(false);
        expect(layoutRouteDeepLink()).toBeNull();
    });

    /**
     * The webview can be rebuilt without the app being killed: Android may
     * reload it while the app is backgrounded by openUrl, and the approve path
     * does a document navigation to the platform's redirect. The flow has no
     * way to re-prompt mid-handoff, so authentication must survive that.
     *
     * A fresh SessionController reading the same sessionStorage is exactly
     * what a rebuilt webview sees. An in-memory field would fail this.
     */
    it("keeps the user authenticated across a webview rebuild", async () => {
        await completeAuthentication();
        layoutRouteDeepLink();

        const rebuilt = new SessionController();

        expect(rebuilt.isAuthenticated).toBe(true);
        expect(hasDeepLink()).toBe(true);
    });

    /**
     * continueAfterSuccessfulAuth() awaits the vault before it routes. A deep
     * link delivered inside that window must find the user already through the
     * gate, which is why markAuthenticated() runs before the first await.
     * Marking it afterwards puts the layout back to reading a stale "logged
     * out" and parking the payload for a screen that has already finished.
     */
    it("is authenticated for a link arriving mid-login, before routing", async () => {
        let seenByLayout: string | null = "never ran";
        globalState = makeGlobalState(session, async () => {
            // The deep link lands while the post-login chores are in flight.
            seenByLayout = layoutRouteDeepLink();
            throw new Error("no vault in tests");
        });

        const authDestination = await completeAuthentication();

        expect(seenByLayout).toBe("/scan-qr");
        expect(authDestination).toBe("/scan-qr");
    });

    /**
     * The layout's deepLinkReceived handler is itself registered for
     * deepLinkReceived. It must never dispatch that event: doing so re-enters
     * the handler synchronously and recurses until the stack overflows. When
     * /scan-qr is the current route it has already received the original event
     * through its own listener, so there is nothing left to deliver.
     */
    it("does not re-dispatch the event it is itself listening for", () => {
        window.location.pathname = "/scan-qr";

        // Wire the handler up exactly as the layout does.
        const handler = (event: Event) =>
            handleDeepLinkEvent((event as CustomEvent).detail, true, navigate);
        listeners.push(handler);

        expect(() =>
            window.dispatchEvent(
                new CustomEvent("deepLinkReceived", { detail: PAYLOAD }),
            ),
        ).not.toThrow();

        // One delivery, not thousands, and no navigation to a route we are on.
        expect(dispatched).toEqual(["deepLinkReceived"]);
        expect(navigate).not.toHaveBeenCalled();
        // The payload is still there for the mount that may not have listened.
        expect(scanQrSeesPayload()).toBe(true);
    });

    it("stores and navigates when the consent screen is not open", () => {
        window.location.pathname = "/main";

        handleDeepLinkEvent(PAYLOAD, true, navigate);

        expect(navigate).toHaveBeenCalledWith("/scan-qr");
        expect(scanQrSeesPayload()).toBe(true);
    });

    it("parks the payload when the app has not finished starting", () => {
        window.location.pathname = "/";

        handleDeepLinkEvent(PAYLOAD, false, navigate);

        expect(navigate).not.toHaveBeenCalled();
        expect(scanQrSeesPayload()).toBe(true);
    });

    /**
     * A user who has just onboarded or recovered has never passed through the
     * splash or /login, so nothing else marks them signed in. Creating or
     * restoring an identity IS proving it, and a deep link that arrived during
     * onboarding has to be actionable the moment they land; otherwise the
     * layout parks it and the consent screen ambushes them later, whenever
     * something next mounts /scan-qr.
     */
    it("treats finishing onboarding as being signed in", async () => {
        layoutRouteDeepLink();
        expect(session.isAuthenticated).toBe(false);

        vi.mocked(goto).mockClear();
        await completeOnboarding(globalState);

        expect(session.isAuthenticated).toBe(true);
        expect(destinationFromGoto()).toBe("/scan-qr");
        expect(scanQrSeesPayload()).toBe(true);
    });

    it("sends a plain onboarding finish to /main", async () => {
        vi.mocked(goto).mockClear();
        await completeOnboarding(globalState);

        expect(destinationFromGoto()).toBe("/main");
        expect(globalState.isOnboardingComplete).toBe(true);
    });

    /** A link arriving after onboarding must route immediately, not be parked. */
    it("routes a link that arrives just after onboarding", async () => {
        await completeOnboarding(globalState);

        expect(layoutRouteDeepLink()).toBe("/scan-qr");
    });

    it("survives storage being unavailable without throwing", async () => {
        vi.stubGlobal("sessionStorage", undefined);

        expect(() => layoutRouteDeepLink()).not.toThrow();
        await expect(completeAuthentication()).resolves.not.toThrow();
        expect(peekDeepLink()).toBeNull();
    });
});
