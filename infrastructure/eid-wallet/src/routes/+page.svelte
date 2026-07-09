<script lang="ts">
import { browser } from "$app/environment";
import { goto } from "$app/navigation";
import SplashScreen from "$lib/fragments/SplashScreen/SplashScreen.svelte";
import type { GlobalState } from "$lib/global";
import { continueAfterSuccessfulAuth } from "$lib/utils/postLogin";
import {
    type AuthOptions,
    authenticate,
    checkStatus,
} from "@tauri-apps/plugin-biometric";
import { getContext, onMount } from "svelte";

const BIOMETRIC_ATTEMPTED_KEY = "biometricAttemptedOnSplash";

const authOpts: AuthOptions = {
    allowDeviceCredential: false,
    cancelTitle: "Cancel",
    fallbackTitle: "Please enter your PIN",
    title: "Login",
    subtitle: "Please authenticate to continue",
    confirmationRequired: true,
};

const getGlobalState = getContext<() => GlobalState | undefined>("globalState");

// Read sync (before first paint) so backward-nav from /onboarding lands
// directly in state C without flashing state A for a frame.
const skipIntro =
    browser && sessionStorage.getItem("splashImmediate") === "true";
if (skipIntro) sessionStorage.removeItem("splashImmediate");

// false = state A (logo "closed"); true = state B (tagline revealed).
let splashOpen = $state(skipIntro);
// true = state C (bottom drawer revealed) — Create/Restore for new users.
// Returning users skip the drawer entirely and auto-redirect to /login.
let splashShowDrawer = $state(skipIntro);

async function handleCreateDigitalSelf() {
    // The mount-guard flag for /onboarding is set centrally by the layout's
    // onNavigate hook (applies to any route that has a refresh guard), so
    // these handlers just need to goto.
    await goto("/onboarding");
}

async function handleRestoreDigitalSelf() {
    await goto("/recover");
}

onMount(async () => {
    if (skipIntro) {
        // Backward nav from /onboarding — already at state C, nothing to do.
        return;
    }

    // Hold state A briefly so the "logo closed" reads as intentional.
    await new Promise((resolve) => setTimeout(resolve, 800));
    splashOpen = true;

    // Give state B a beat to land before deciding what comes next.
    await new Promise((resolve) => setTimeout(resolve, 400));

    // Wait for layout's globalState init if it hasn't landed yet.
    let globalState = getGlobalState?.();
    let retries = 0;
    while (!globalState && retries < 50) {
        await new Promise((resolve) => setTimeout(resolve, 100));
        globalState = getGlobalState?.();
        retries++;
    }

    let onboardingComplete = false;
    let userExists = false;
    if (globalState) {
        try {
            onboardingComplete = await globalState.isOnboardingComplete;
            userExists = !!(await globalState.userController.user);
        } catch (error) {
            console.error("Failed to read onboarding state:", error);
        }
    }

    if (onboardingComplete && userExists) {
        // Returning user.
        const pinHash = globalState
            ? await globalState.securityController.pinHash
            : null;

        // If no PIN is set we bounce back to onboarding to recover; no
        // biometric prompt makes sense from that state.
        if (!pinHash) {
            await goto("/onboarding");
            return;
        }

        // A third-party login deep link opened the app. The root layout has
        // already stored it and redirected to /login, which runs its own
        // biometric prompt. If we ALSO prompt here, two native authenticate()
        // calls race on a cold start — the collision, plus a duplicate
        // post-auth routine consuming the pending deep link, leaves the user
        // on /main with the consent screen never shown. Defer to /login as the
        // single authenticator. The layout writes pendingDeepLink synchronously
        // and early, so it's reliably visible by the time we reach here.
        if (sessionStorage.getItem("pendingDeepLink")) {
            await goto("/login");
            return;
        }

        // Fire biometric over the splash itself so the prompt isn't competing
        // with the /login slide-in. On success we run the post-auth chores
        // and route straight to /main (no /login flash). On cancel/fail we
        // slide into /login with a sessionStorage flag so /login knows the
        // biometric attempt already happened and skips re-prompting.
        let biometricAvailable = false;
        try {
            biometricAvailable =
                !!globalState &&
                (await globalState.securityController.biometricSupport) &&
                (await checkStatus()).isAvailable;
        } catch (error) {
            console.error("Biometric availability check failed:", error);
        }

        if (biometricAvailable && globalState) {
            sessionStorage.setItem(BIOMETRIC_ATTEMPTED_KEY, "true");
            try {
                await authenticate(
                    "You must authenticate with PIN first",
                    authOpts,
                );
                // Success — clear the flag (we won't reach /login at all)
                // and run the shared post-auth routine.
                sessionStorage.removeItem(BIOMETRIC_ATTEMPTED_KEY);
                await continueAfterSuccessfulAuth(globalState);
                return;
            } catch (e) {
                // Cancel/fail. Leave the flag set so /login skips its own
                // biometric retry, then slide into /login for PIN entry.
                console.warn("Biometric on splash failed", e);
            }
        }

        await goto("/login");
        return;
    }

    // First-time user — reveal the drawer with CTAs.
    splashShowDrawer = true;
});
</script>

<SplashScreen
    open={splashOpen}
    showDrawer={splashShowDrawer}
    oncreate={handleCreateDigitalSelf}
    onrestore={handleRestoreDigitalSelf}
/>
