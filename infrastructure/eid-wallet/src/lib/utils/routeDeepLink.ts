import { goto } from "$app/navigation";
import type { GlobalState } from "$lib/global";
import { storeDeepLink } from "$lib/stores/deepLink";

/**
 * Route a parsed deep-link payload: the layout's half of the rendezvous.
 *
 * The payload is stored whatever the authentication state, so that whichever
 * side of the race finishes second can pick it up. Only an authenticated user
 * is routed onward; otherwise the payload is parked for
 * continueAfterSuccessfulAuth() to collect.
 *
 * See docs/architecture/deepLink.md.
 */
export function routeDeepLink(
    gs: GlobalState | undefined,
    deepLinkData: Record<string, unknown>,
): void {
    // Store it either way: the payload is the same regardless of who
    // ends up routing it.
    storeDeepLink(deepLinkData);

    if (!gs?.sessionController.isAuthenticated) {
        console.log("Deep link stored: user has not authenticated yet");
        return;
    }

    console.log("Deep link routed: user is already authenticated");

    // The event covers an already-mounted /scan-qr; the stored payload
    // covers the mount that the goto() below triggers.
    window.dispatchEvent(
        new CustomEvent("deepLinkReceived", { detail: deepLinkData }),
    );

    if (window.location.pathname !== "/scan-qr") {
        goto("/scan-qr").catch((error) => {
            console.error("Error navigating to scan-qr:", error);
        });
    }
}

/**
 * Handle a `deepLinkReceived` event in the root layout: the payload has
 * already been parsed, and may have arrived while the app was still starting.
 *
 * `/scan-qr` registers its own `deepLinkReceived` listener, so when it is the
 * current route it has already received this same event directly. This
 * function must therefore never re-dispatch `deepLinkReceived`: the layout
 * listens for that event itself, so a re-dispatch re-enters this handler
 * synchronously and recurses until the stack overflows.
 *
 * The payload is stored in every case, which covers both a page that has not
 * mounted its listener yet and one that is about to be navigated to.
 */
export function handleDeepLinkEvent(
    detail: unknown,
    isReady: boolean,
    navigate: (path: string) => Promise<void> = goto,
): void {
    storeDeepLink(detail);

    // Not ready, or already where the payload is consented to: the mount reads
    // the stored payload, so there is nothing left to do.
    if (!isReady || window.location.pathname === "/scan-qr") {
        return;
    }

    navigate("/scan-qr").catch((error) => {
        console.error("Error navigating to scan-qr:", error);
    });
}
