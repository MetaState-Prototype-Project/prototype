import { beforeEach, describe, expect, it, vi } from "vitest";

import type { GlobalState } from "$lib/global";
import { peekDeepLink, storeDeepLink } from "$lib/stores/deepLink";
import { get } from "svelte/store";
import { createScanLogic } from "./scanLogic";

vi.mock("@tauri-apps/api/app", () => ({
    getVersion: vi.fn(async () => "1.3.0"),
}));
vi.mock("@tauri-apps/plugin-opener", () => ({
    openUrl: vi.fn(async () => {}),
}));
vi.mock("@tauri-apps/plugin-barcode-scanner", () => ({
    Format: { QRCode: "QR_CODE" },
    cancel: vi.fn(async () => {}),
    checkPermissions: vi.fn(async () => "denied"),
    openAppSettings: vi.fn(async () => {}),
    requestPermissions: vi.fn(async () => "denied"),
    scan: vi.fn(() => new Promise(() => {})),
}));
vi.mock("wallet-sdk", () => ({ authenticate: vi.fn() }));

/** Minimal sessionStorage stand-in; the pending payload is storage-backed. */
class MemoryStorage implements Storage {
    private valuesByKey = new Map<string, string>();
    get length() {
        return this.valuesByKey.size;
    }
    clear() {
        this.valuesByKey.clear();
    }
    getItem(key: string) {
        return this.valuesByKey.get(key) ?? null;
    }
    key(index: number) {
        return Array.from(this.valuesByKey.keys())[index] ?? null;
    }
    removeItem(key: string) {
        this.valuesByKey.delete(key);
    }
    setItem(key: string, value: string) {
        this.valuesByKey.set(key, String(value));
    }
}

/** Listeners registered on the stubbed window, keyed by event type. */
let windowListenersByEventType: Map<string, ((event: Event) => void)[]>;

/** Deliver an event the way routeDeepLink() does for a mounted /scan-qr. */
function dispatchDeepLinkReceived(detail: unknown): void {
    const event = { type: "deepLinkReceived", detail } as unknown as Event;
    for (const listener of windowListenersByEventType.get(event.type) ?? []) {
        listener(event);
    }
}

/** Let the async deep-link handling and its clean-up settle. */
async function settle(): Promise<void> {
    for (let tick = 0; tick < 10; tick++) await Promise.resolve();
}

const AUTH_DEEP_LINK = {
    type: "auth",
    session: "21fcc8a5",
    platform: "pictique",
    redirect: "https://pictique.example/api/auth",
};

function createMountedScanLogic() {
    const globalState = {
        vaultController: {
            vault: Promise.resolve({ ename: "@user" }),
        },
    } as unknown as GlobalState;
    return createScanLogic({ globalState, goto: vi.fn(async () => {}) });
}

beforeEach(() => {
    vi.stubGlobal("sessionStorage", new MemoryStorage());
    windowListenersByEventType = new Map();
    vi.stubGlobal("window", {
        addEventListener: (type: string, listener: (event: Event) => void) => {
            const listeners = windowListenersByEventType.get(type) ?? [];
            listeners.push(listener);
            windowListenersByEventType.set(type, listeners);
        },
        removeEventListener: (
            type: string,
            listener: (event: Event) => void,
        ) => {
            const listeners = windowListenersByEventType.get(type) ?? [];
            windowListenersByEventType.set(
                type,
                listeners.filter((registered) => registered !== listener),
            );
        },
        location: { pathname: "/scan-qr" },
    });
});

describe("scan-qr deep links while the page is already open", () => {
    /**
     * Logging in to a platform, logging out and tapping its eID button again
     * leaves the wallet on /scan-qr with the previous login's "signed in"
     * drawer showing. That drawer is a finished login, not one in progress,
     * so the new link has to open the consent drawer on the first tap.
     */
    it("shows consent for an auth link that arrives over a finished login", async () => {
        const { stores, actions } = createMountedScanLogic();
        storeDeepLink(AUTH_DEEP_LINK);
        await actions.initialize();
        expect(get(stores.codeScannedDrawerOpen)).toBe(true);

        // The first login completes and the "signed in" drawer is shown.
        actions.setCodeScannedDrawerOpen(false);
        actions.setLoggedInDrawerOpen(true);

        storeDeepLink(AUTH_DEEP_LINK);
        dispatchDeepLinkReceived(AUTH_DEEP_LINK);
        await settle();

        expect(get(stores.codeScannedDrawerOpen)).toBe(true);
        expect(get(stores.loggedInDrawerOpen)).toBe(false);
        expect(get(stores.session)).toBe(AUTH_DEEP_LINK.session);
    });

    /**
     * The layout stores every payload before notifying the open page. Once
     * the page has shown it, a payload left behind would be replayed by the
     * next mount of /scan-qr and read by the approve path as still pending.
     */
    it("clears the stored payload once the open page has shown it", async () => {
        const { actions } = createMountedScanLogic();
        await actions.initialize();

        storeDeepLink(AUTH_DEEP_LINK);
        dispatchDeepLinkReceived(AUTH_DEEP_LINK);
        await settle();

        expect(peekDeepLink()).toBeNull();
    });

    it("still ignores a repeat of the request whose consent is open", async () => {
        const { stores, actions } = createMountedScanLogic();
        storeDeepLink(AUTH_DEEP_LINK);
        await actions.initialize();
        stores.platform.set("left untouched by a duplicate");

        dispatchDeepLinkReceived(AUTH_DEEP_LINK);
        await settle();

        expect(get(stores.codeScannedDrawerOpen)).toBe(true);
        expect(get(stores.platform)).toBe("left untouched by a duplicate");
    });

    it("replaces an open consent with a newer login request", async () => {
        const { stores, actions } = createMountedScanLogic();
        storeDeepLink(AUTH_DEEP_LINK);
        await actions.initialize();

        const newerAuthDeepLink = { ...AUTH_DEEP_LINK, session: "9b1e0c42" };
        dispatchDeepLinkReceived(newerAuthDeepLink);
        await settle();

        expect(get(stores.codeScannedDrawerOpen)).toBe(true);
        expect(get(stores.session)).toBe(newerAuthDeepLink.session);
    });
});
