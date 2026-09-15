import { goto } from "$app/navigation";
import type { GlobalState } from "$lib/global";
import {
    endAuthPrompt,
    isDeepLinkFlowActive,
    markWalletAuthenticated,
    peekDeepLinkPayload,
    promotePendingDeepLink,
} from "$lib/utils/deepLinkFlow";

/**
 * Shared post-authentication routine: fires the background eVault chores
 * (health check, public-key sync, push registration) and routes the user
 * either to the deep-link target waiting in sessionStorage or to /main.
 *
 * Called from both the splash (when biometric auth succeeds over the
 * splash screen) and from /login (after PIN or fallback biometric).
 * Keeping the logic here means we don't have to flash the user through
 * /login on biometric success.
 *
 * Callers must still have the auth prompt bracket OPEN when they call this
 * (see beginAuthPrompt). This function closes it itself, at the one moment
 * where closing it is safe. Ending the bracket in the caller first would
 * reopen the race being fixed: the awaits below would then run unbracketed, so
 * a deep link landing during them would issue its own navigation while this
 * routine was on its way to a different destination.
 */
export async function continueAfterSuccessfulAuth(
    gs: GlobalState,
): Promise<void> {
    // Record the session as authenticated BEFORE any await. A deep link that
    // lands while the chores below are in flight must be able to see that the
    // user is already through the gate, so it routes itself straight to the
    // consent screen instead of parking a payload nobody will collect.
    markWalletAuthenticated();

    // Fire-and-forget post-login chores. They hit the network with no client
    // timeout, so awaiting them here can strand the user on a spinner — the
    // app pages will retry as needed.
    try {
        const vault = await gs.vaultController.vault;
        if (vault?.ename) {
            const ename = vault.ename;
            void gs.vaultController
                .checkHealth(ename)
                .then((health) => {
                    if (!health.healthy) {
                        console.warn(
                            "eVault health check failed:",
                            health.error,
                        );
                    }
                })
                .catch((error) =>
                    console.error("eVault health check error:", error),
                );
            void gs.vaultController
                .syncPublicKey(ename)
                .catch((error) =>
                    console.error("Error syncing public key:", error),
                );
            void gs.notificationService
                .registerDevice(ename)
                .catch((error) =>
                    console.error(
                        "Error registering device for notifications:",
                        error,
                    ),
                );
        }
    } catch (error) {
        console.error("Error reading vault during login:", error);
    }

    // ---- Handover. Everything from here to the goto() runs synchronously. ----
    //
    // No `await` may be introduced in this block. JavaScript is single
    // threaded, so with no suspension point a deep-link callback cannot
    // interleave between releasing the prompt bracket and reading the payload.
    // That is what makes the handover atomic: every URL is either parked
    // before this block (and collected here) or delivered after it (and
    // routed by the layout itself, which by now sees an authenticated
    // session). There is no third case, and so no window in which a payload is
    // stored but nobody is left to act on it.

    // Collect anything parked while the user was authenticating. Both steps
    // matter: the payload may have been stored before the prompt (promote
    // finds it) or delivered during the awaits above and written straight to
    // deepLinkData (only the flag sees it).
    promotePendingDeepLink();
    const hasPendingDeepLink =
        isDeepLinkFlowActive() && !!peekDeepLinkPayload();

    // Release the bracket. From this instant the layout resumes navigating for
    // itself, which is correct: the session is now marked authenticated, so a
    // late URL routes straight to the consent screen.
    endAuthPrompt();

    if (hasPendingDeepLink) {
        try {
            await goto("/scan-qr", { replaceState: true });
            return;
        } catch (error) {
            // Leave the payload in place — /scan-qr clears it once handled, and
            // a failed navigation here should not silently discard the user's
            // pending login request.
            console.error("Error navigating to pending deep link:", error);
        }
    }

    await goto("/main", { replaceState: true });
}
