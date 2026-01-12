<script lang="ts">
import { goto } from "$app/navigation";
import { page } from "$app/state";
import type { GlobalState } from "$lib/global";
import { getContext, onMount } from "svelte";

let { children } = $props();
let isChecking = $state(true);
let vaultExists = $state(false);
let guardFailed = $state(false);

const getGlobalState = getContext<() => GlobalState>("globalState");

onMount(async () => {
    try {
        const globalState = getGlobalState();
        if (!globalState) {
            console.error("Global state is not defined");
            guardFailed = true;
            return;
        }

        // Check if user is already authenticated
        const vault = await globalState.vaultController.vault;
        if (vault) {
            vaultExists = true;
            console.log("User already authenticated, redirecting to main");
            // Use replaceState to prevent infinite back loops
            await goto("/main", { replaceState: true });
            return;
        }

        if (globalState.isOnboardingComplete) {
            const pinHash = await globalState.securityController.pinHash;
            const isAlreadyAtLogin = page.url.pathname === "/login";

            if (pinHash && !isAlreadyAtLogin) {
                console.log(
                    "Onboarding already complete, redirecting to login",
                );
                await goto("/login", { replaceState: true });
                return;
            }
        }
    } catch (error) {
        console.error("Error in auth layout guard:", error);
    } finally {
        isChecking = false;
    }
});
</script>

{#if isChecking}
    <div class="h-screen w-screen bg-background"></div>
{:else if guardFailed}
    <div
        class="flex h-screen w-screen items-center justify-center bg-background"
    >
        <p class="text-center text-sm text-foreground-muted">
            An unexpected error occurred. Please restart the application.
        </p>
    </div>
{:else if !vaultExists}
    {@render children()}
{/if}
