<script lang="ts">
import { goto } from "$app/navigation";
import { page } from "$app/state";
import type { GlobalState } from "$lib/global";
import type { PluginListener } from "@tauri-apps/api/core";
import type { Snippet } from "svelte";
import { getContext, onDestroy, onMount } from "svelte";
import type { LayoutData } from "./$types";

let { data, children }: { data: LayoutData; children: Snippet } = $props();

let currentRoute = $derived(page.url.pathname.split("/").pop() || "home");
let globalState: GlobalState | undefined = $state(undefined);
let notificationListener: PluginListener | undefined;

onMount(async () => {
    // Get global state — poll briefly since root layout's init is async and
    // can land after this guard mounts on a hard reload.
    const getGlobalState = getContext<() => GlobalState>("globalState");
    globalState = getGlobalState();
    let retries = 0;
    while (!globalState && retries < 50) {
        await new Promise((r) => setTimeout(r, 100));
        globalState = getGlobalState();
        retries++;
    }

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
            const ename =
                vault && "ename" in vault ? String(vault.ename) : undefined;
            if (ename) {
                await notificationService.registerDevice(ename);
            }
        } catch (error) {
            console.error(
                "Failed to register device for notifications:",
                error,
            );
        }

        // Listen for push notifications while app is in the foreground
        try {
            notificationListener =
                await globalState.notificationService.listenForForegroundNotifications();
        } catch (error) {
            console.error("Failed to set up notification listener:", error);
        }

        // Check for pending notifications and navigate to the message's open page
        try {
            const notificationService = globalState.notificationService;
            const notifData =
                await notificationService.checkAndShowNotifications();
            if (notifData?.globalChatId) {
                const params = new URLSearchParams({
                    chatId: notifData.globalChatId,
                    ...(notifData.title && { title: notifData.title }),
                    ...(notifData.body && { body: notifData.body }),
                });
                await goto(
                    `/open-message/${encodeURIComponent(notifData.globalMessageId || notifData.globalChatId)}?${params.toString()}`,
                );
            }
        } catch (error) {
            console.error("Failed to check notifications:", error);
        }
    } catch (error) {
        console.log("Authentication check failed, redirecting to login");
        await goto("/login");
        return;
    }
});

onDestroy(() => {
    notificationListener?.unregister();
});

// Wait for the route slide-in to finish (200ms in the root layout) before
// making the wrapper transparent — otherwise the camera-feed transparency
// kicks in mid-slide and /main shows through the incoming /scan-qr page.
$effect(() => {
    const isScanPage = currentRoute === "scan-qr";
    if (isScanPage) {
        const t = setTimeout(
            () => document.body.classList.add("custom-global-style"),
            220,
        );
        return () => clearTimeout(t);
    }
    document.body.classList.remove("custom-global-style");
});
</script>

<!-- Dev only: remove this when deploying to production -->
<!-- {#if currentRoute === "scan-qr"}
<div class="fixed -z-10 bg-black w-screen h-screen top-0">
    <img src="/images/dummyScan.png" class="opacity-40 w-screen h-screen object-cover" alt="dummy scan">
</div>
{/if} -->

<div
    data-route-wrapper
    class="px-4 pb-4 bg-white"
    style="padding-top: max(2.5rem, calc(env(safe-area-inset-top) + 1rem));"
>
    {@render children()}
</div>

<style>
    /* On /scan-qr the body goes transparent so the Tauri camera feed shows
       through. Only the route wrappers (data-route-wrapper) need to follow —
       targeting *every* descendant also clobbered drawer backgrounds and
       caused overflow-y:hidden to clip every shadow in the tree. */
    :global(body.custom-global-style) {
        background-color: transparent;
        overflow: hidden;
    }
    :global(body.custom-global-style [data-route-wrapper]) {
        background-color: transparent !important;
    }
</style>
