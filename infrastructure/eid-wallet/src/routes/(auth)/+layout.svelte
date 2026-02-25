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
        const isLoginPage = page.url.pathname === "/login";
        console.log(
            "[AUTH GUARD] path:",
            page.url.pathname,
            "| vault:",
            !!vault,
        );
        if (vault && !isLoginPage) {
            vaultExists = true;
            console.log("[AUTH GUARD] vault exists + not login → /main");
            // Use replaceState to prevent infinite back loops
            await goto("/main", { replaceState: true });
            return;
        }

        const onboardingComplete = await globalState.isOnboardingComplete;
        console.log("[AUTH GUARD] onboardingComplete:", onboardingComplete);
        if (onboardingComplete) {
            const pinHash = await globalState.securityController.pinHash;
            const isAlreadyAtLogin = page.url.pathname === "/login";
            console.log(
                "[AUTH GUARD] pinHash:",
                !!pinHash,
                "| isAlreadyAtLogin:",
                isAlreadyAtLogin,
            );

            if (pinHash && !isAlreadyAtLogin) {
                console.log(
                    "[AUTH GUARD] onboarding complete + pinHash + not at login → /login",
                );
                await goto("/login", { replaceState: true });
                return;
            }
        }
    } catch (error) {
        console.error("Error in auth layout guard:", error);
        guardFailed = true;
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
