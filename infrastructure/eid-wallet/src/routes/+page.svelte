<script lang="ts">
import { goto } from "$app/navigation";
import type { GlobalState } from "$lib/global";
import SplashScreen from "$lib/fragments/SplashScreen/SplashScreen.svelte";
import { getContext, onMount } from "svelte";

let globalState: GlobalState | undefined = $state(undefined);
let isRedirecting = $state(true);

let clearPin = $state(async () => {});
let cleared = $state(false);

onMount(async () => {
    // Wait for globalState to be available (it's initialized in the layout)
    const getGlobalState = getContext<() => GlobalState>("globalState");
    let retries = 0;
    const maxRetries = 50; // Wait up to 5 seconds

    while (!globalState && retries < maxRetries) {
        globalState = getGlobalState();
        if (!globalState) {
            await new Promise((resolve) => setTimeout(resolve, 100));
            retries++;
        }
    }

    if (!globalState) {
        console.error("Global state is still not defined after waiting");
        return;
    }

    clearPin = async () => {
        try {
            await globalState?.securityController.clearPin();
            cleared = true;
        } catch (error) {
            console.error("Failed to clear PIN:", error);
            // Consider adding user-facing error feedback
        }
    };
    let onboardingComplete = false;
    try {
        onboardingComplete = await globalState.isOnboardingComplete;
    } catch (error) {
        console.error("Failed to determine onboarding status:", error);
    }

    if (!onboardingComplete || !(await globalState.userController.user)) {
        await goto("/onboarding");
        return;
    }
    if (!(await globalState.securityController.pinHash)) {
        await goto("/register");
        return;
    }
    await goto("/login");
});
</script>

{#if isRedirecting}
    <div class="fixed inset-0 flex items-center justify-center bg-white">
        <SplashScreen />
    </div>
{/if}
