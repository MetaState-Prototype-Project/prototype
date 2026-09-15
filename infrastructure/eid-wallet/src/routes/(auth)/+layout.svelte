<script lang="ts">
import { goto } from "$app/navigation";
import { page } from "$app/state";
import type { GlobalState } from "$lib/global";
import { shouldAbortStaleContinuation } from "$lib/utils/deepLinkFlow";
import { getContext, onDestroy, onMount } from "svelte";

let { children } = $props();
let isChecking = $state(true);
let vaultExists = $state(false);
let guardFailed = $state(false);

const getGlobalState = getContext<() => GlobalState>("globalState");
let destroyed = false;

onDestroy(() => {
    destroyed = true;
});

function superseded(): boolean {
    return shouldAbortStaleContinuation(destroyed);
}

onMount(async () => {
    try {
        // Root layout init is async — on a hard reload directly into an
        // (auth) route, this guard can mount before globalState is set.
        // Poll briefly instead of failing immediately.
        let globalState = getGlobalState();
        let retries = 0;
        while (!globalState && retries < 50) {
            await new Promise((r) => setTimeout(r, 100));
            if (superseded()) return;
            globalState = getGlobalState();
            retries++;
        }
        if (superseded()) return;
        if (!globalState) {
            console.error("Global state is not defined");
            guardFailed = true;
            return;
        }

        // Check if user is already authenticated
        const vault = await globalState.vaultController.vault;
        if (superseded()) return;
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
        if (superseded()) return;
        console.log("[AUTH GUARD] onboardingComplete:", onboardingComplete);
        if (onboardingComplete) {
            const pinHash = await globalState.securityController.pinHash;
            if (superseded()) return;
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
