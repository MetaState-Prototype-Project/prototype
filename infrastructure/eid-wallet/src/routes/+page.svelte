<script lang="ts">
import { browser } from "$app/environment";
import { goto } from "$app/navigation";
import SplashScreen from "$lib/fragments/SplashScreen/SplashScreen.svelte";
import type { GlobalState } from "$lib/global";
import { getContext, onMount } from "svelte";

const getGlobalState = getContext<() => GlobalState | undefined>("globalState");

// Read sync (before first paint) so backward-nav from /onboarding lands
// directly in state C without flashing state A for a frame.
const skipIntro =
    browser && sessionStorage.getItem("splashImmediate") === "true";
if (skipIntro) sessionStorage.removeItem("splashImmediate");

// false = state A (logo "closed"); true = state B (tagline revealed).
let splashOpen = $state(skipIntro);
// true = state C (bottom drawer with CTAs revealed); shown for both new users
// (Create / Restore CTAs) and returning users (single Continue CTA).
let splashShowDrawer = $state(skipIntro);
// When set, the drawer renders a single "Continue" button that navigates to
// this route on tap. The tap is the user gesture Android needs to auto-open
// the soft keyboard on /login.
let returningUserTarget = $state<string | null>(null);

async function handleCreateDigitalSelf() {
    // The mount-guard flag for /onboarding is set centrally by the layout's
    // onNavigate hook (applies to any route that has a refresh guard), so
    // these handlers just need to goto.
    await goto("/onboarding");
}

async function handleRestoreDigitalSelf() {
    await goto("/recover");
}

async function handleContinue() {
    if (returningUserTarget) await goto(returningUserTarget);
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
        // Returning user — surface a single "Continue" CTA in the drawer
        // instead of auto-redirecting. The tap carries the user gesture
        // Android requires to auto-open the soft keyboard on /login.
        const pinHash = globalState
            ? await globalState.securityController.pinHash
            : null;
        returningUserTarget = pinHash ? "/login" : "/register";
        splashShowDrawer = true;
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
    oncontinue={returningUserTarget ? handleContinue : undefined}
/>
