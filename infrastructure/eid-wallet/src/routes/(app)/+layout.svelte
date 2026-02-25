<script lang="ts">
import { goto } from "$app/navigation";
import { page } from "$app/state";
import type { GlobalState } from "$lib/global";
import type { Snippet } from "svelte";
import { getContext, onMount } from "svelte";
import type { LayoutData } from "./$types";

let { data, children }: { data: LayoutData; children: Snippet } = $props();

let currentRoute = $derived(page.url.pathname.split("/").pop() || "home");
let globalState: GlobalState | undefined = $state(undefined);

onMount(async () => {
    // Get global state
    globalState = getContext<() => GlobalState>("globalState")();

    // Authentication guard for all app routes
    try {
        if (!globalState) {
            console.log("No global state, redirecting to login");
            await goto("/login");
            return;
        }

        const vault = await globalState.vaultController.vault;
        if (!vault) {
            console.log("User not authenticated, redirecting to login");
            await goto("/login");
            return;
        }

        console.log("User authenticated, allowing access to app routes");

        // Register device for push notifications (eName + token to provisioner)
        try {
            const notificationService = globalState.notificationService;
            const ename = vault && "ename" in vault ? String(vault.ename) : undefined;
            if (ename) {
                await notificationService.registerDevice(ename);
            }
        } catch (error) {
            console.error("Failed to register device for notifications:", error);
        }

        // Check for notifications after successful authentication
        try {
            const notificationService = globalState.notificationService;
            await notificationService.checkAndShowNotifications();
        } catch (error) {
            console.error("Failed to check notifications:", error);
        }
    } catch (error) {
        console.log("Authentication check failed, redirecting to login");
        await goto("/login");
        return;
    }
});

$effect(() => {
    const isScanPage = currentRoute === "scan-qr";
    if (isScanPage) return document.body.classList.add("custom-global-style");
    return document.body.classList.remove("custom-global-style");
});
</script>

<!-- Dev only: remove this when deploying to production -->
<!-- {#if currentRoute === "scan-qr"}
<div class="fixed -z-10 bg-black w-screen h-screen top-0">
    <img src="/images/dummyScan.png" class="opacity-40 w-screen h-screen object-cover" alt="dummy scan">
</div>
{/if} -->

<div class="p-6 pt-10">
    {@render children()}
</div>

<style>
    :global(body.custom-global-style, body.custom-global-style *:not(button)) {
        background-color: #00000000;
        overflow-y: hidden;
    }
</style>
