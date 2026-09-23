<script lang="ts">
import { browser } from "$app/environment";
import { goto } from "$app/navigation";
import SplashScreen from "$lib/fragments/SplashScreen/SplashScreen.svelte";
import type { GlobalState } from "$lib/global";
import { m } from "$lib/i18n";
import { continueAfterSuccessfulAuth } from "$lib/utils/postLogin";
import {
    type AuthOptions,
    authenticate,
    checkStatus,
} from "@tauri-apps/plugin-biometric";
import { getContext, onDestroy, onMount } from "svelte";

const authOpts: AuthOptions = {
    allowDeviceCredential: false,
    cancelTitle: m.common_cancel(),
    fallbackTitle: m.login_biometric_fallback(),
    title: m.login_biometric_title(),
    subtitle: m.login_biometric_subtitle(),
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

// Unmounting a Svelte component does NOT cancel an async onMount parked on an
// await: the continuation resumes later and calls goto() from a screen the user
// left long ago. This routine sleeps 1.2s and then polls for global state, so
// it can still be suspended while the user authenticates by PIN on /login and
// /scan-qr opens the consent drawer. Waking then would navigate away and take
// that drawer with it.
let destroyed = false;
onDestroy(() => {
    destroyed = true;
});

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

    if (destroyed) return;

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

        // The ONLY biometric prompt in the app. /login is the PIN fallback and
        // never prompts, so the dialog always appears over this screen. On
        // success we run the post-auth chores and route onward with no /login
        // flash; on cancel, failure or unavailability we slide into /login.
        let biometricAvailable = false;
        try {
            biometricAvailable =
                !!globalState &&
                (await globalState.securityController.biometricSupport) &&
                (await checkStatus()).isAvailable;
        } catch (error) {
            console.error("Biometric availability check failed:", error);
        }
        if (destroyed) return;

        if (biometricAvailable && globalState) {
            try {
                await authenticate(m.login_biometric_reason(), authOpts);
                await continueAfterSuccessfulAuth(globalState);
                return;
            } catch (e) {
                // Cancel/fail — slide into /login for PIN entry.
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
