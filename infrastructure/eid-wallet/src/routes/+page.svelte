<script lang="ts">
import { browser } from "$app/environment";
import { goto } from "$app/navigation";
import SplashScreen from "$lib/fragments/SplashScreen/SplashScreen.svelte";
import type { GlobalState } from "$lib/global";
import {
    beginAuthPrompt,
    endAuthPrompt,
    isDeepLinkFlowActive,
    shouldAbortStaleContinuation,
} from "$lib/utils/deepLinkFlow";
import { continueAfterSuccessfulAuth } from "$lib/utils/postLogin";
import {
    type AuthOptions,
    authenticate,
    checkStatus,
} from "@tauri-apps/plugin-biometric";
import { getContext, onDestroy, onMount } from "svelte";

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
const initialDeepLinkReady = getContext<Promise<void>>("initialDeepLinkReady");

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

// Unmounting a Svelte component does NOT cancel an async onMount that is
// parked on an await: the continuation resumes later and happily calls goto()
// from a screen the user left long ago. This routine sleeps for 1.2s and then
// awaits storage and the deep-link handshake, so on a cold start it is still
// suspended while the layout redirects to /login, the user authenticates and
// /scan-qr opens the consent drawer. When it finally wakes it would navigate
// away and take that drawer with it. Every await below is therefore followed
// by a liveness check.
let destroyed = false;
onDestroy(() => {
    destroyed = true;
});

/** True once this screen is gone or the user is already through the gate. */
function superseded(): boolean {
    return shouldAbortStaleContinuation(destroyed);
}

onMount(async () => {
    if (skipIntro) {
        // Backward nav from /onboarding — already at state C, nothing to do.
        return;
    }

    // Hold state A briefly so the "logo closed" reads as intentional.
    await new Promise((resolve) => setTimeout(resolve, 800));
    if (superseded()) return;
    splashOpen = true;

    // Give state B a beat to land before deciding what comes next.
    await new Promise((resolve) => setTimeout(resolve, 400));
    if (superseded()) return;

    // Wait for layout's globalState init if it hasn't landed yet.
    let globalState = getGlobalState?.();
    let retries = 0;
    while (!globalState && retries < 50) {
        await new Promise((resolve) => setTimeout(resolve, 100));
        if (superseded()) return;
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
    if (superseded()) return;

    if (onboardingComplete && userExists) {
        // Returning user.
        const pinHash = globalState
            ? await globalState.securityController.pinHash
            : null;
        if (superseded()) return;

        // If no PIN is set we bounce back to onboarding to recover; no
        // biometric prompt makes sense from that state.
        if (!pinHash) {
            await goto("/onboarding");
            return;
        }

        // The root layout discovers a cold-start URL asynchronously. Wait for
        // that discovery before deciding whether this is an ordinary launch,
        // otherwise fast biometric authentication wins the race and routes to
        // /main before the payload has even been stored.
        await initialDeepLinkReady;
        if (superseded()) return;

        // A third-party login deep link opened the app. The root layout has
        // stored it and redirected to /login, which runs its own biometric
        // prompt. Prompting here as well puts two native authenticate() calls
        // on screen at once and lets two post-auth routines fight over a
        // single payload — the user ends up on /main and the consent screen is
        // never shown. Defer to /login as the single authenticator.
        //
        // Ask the sticky flow flag rather than reading pendingDeepLink: by the
        // time we get here the payload may already have been promoted to
        // deepLinkData, and the raw key read would report "no deep link".
        if (isDeepLinkFlowActive()) {
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
        if (superseded()) return;

        if (biometricAvailable && globalState) {
            sessionStorage.setItem(BIOMETRIC_ATTEMPTED_KEY, "true");
            // Tell the deep-link handler that a prompt owns the screen. A URL
            // arriving while the user's finger is on the sensor must park its
            // payload and let continueAfterSuccessfulAuth route, instead of
            // firing its own competing navigation.
            beginAuthPrompt();
            try {
                await authenticate(
                    "You must authenticate with PIN first",
                    authOpts,
                );
                // Success — clear the flag (we won't reach /login at all)
                // and run the shared post-auth routine.
                sessionStorage.removeItem(BIOMETRIC_ATTEMPTED_KEY);
                // NOTE: the prompt bracket stays OPEN here on purpose.
                // continueAfterSuccessfulAuth closes it itself, at the exact
                // point where it has collected any pending payload. Closing it
                // here would leave that routine's awaits unbracketed and
                // reopen the navigation race.
                await continueAfterSuccessfulAuth(globalState);
                return;
            } catch (e) {
                // Cancel/fail. Leave the flag set so /login skips its own
                // biometric retry, then slide into /login for PIN entry.
                console.warn("Biometric on splash failed", e);
            } finally {
                // Idempotent: a no-op on the success path, where
                // continueAfterSuccessfulAuth has already released it.
                endAuthPrompt();
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
