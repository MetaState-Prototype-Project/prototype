import { goto } from "$app/navigation";
import type { GlobalState } from "$lib/global";

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

    const pendingDeepLink = sessionStorage.getItem("pendingDeepLink");
    if (pendingDeepLink) {
        try {
            sessionStorage.setItem("deepLinkData", pendingDeepLink);
            sessionStorage.removeItem("pendingDeepLink");
            await goto("/scan-qr");
            return;
        } catch (error) {
            console.error("Error processing pending deep link:", error);
            sessionStorage.removeItem("pendingDeepLink");
            sessionStorage.removeItem("deepLinkData");
        }
    }

    await goto("/main");
}
