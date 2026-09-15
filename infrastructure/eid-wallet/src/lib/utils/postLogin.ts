import { goto } from "$app/navigation";
import type { GlobalState } from "$lib/global";
import {
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

    // Promote any payload that was parked while the user authenticated, then
    // re-check the flow flag. Both steps matter: the payload may have been
    // stored before the prompt (promote finds it) or delivered during the
    // awaits above and written straight to deepLinkData (only the flag sees
    // it). Checking just one of the two is what let the consent screen slip
    // through the cracks on a fast cold start.
    promotePendingDeepLink();

    if (isDeepLinkFlowActive() && peekDeepLinkPayload()) {
        try {
            await goto("/scan-qr");
            return;
        } catch (error) {
            // Leave the payload in place — /scan-qr clears it once handled, and
            // a failed navigation here should not silently discard the user's
            // pending login request.
            console.error("Error navigating to pending deep link:", error);
        }
    }

    await goto("/main");
}
