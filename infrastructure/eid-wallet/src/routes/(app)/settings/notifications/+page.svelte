<script lang="ts">
import { goto } from "$app/navigation";
import type { GlobalState } from "$lib/global";
import { runtime } from "$lib/global/runtime.svelte";
import NotificationService from "$lib/services/NotificationService";
import { isPermissionGranted } from "@choochmeque/tauri-plugin-notifications-api";
import { Notification02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/svelte";
import { openAppSettings } from "@tauri-apps/plugin-barcode-scanner";
import { getContext, onMount } from "svelte";

let globalState: GlobalState | undefined = $state(undefined);
let enabled = $state(false);
let hint = $state<string | null>(null);
let working = $state(false);

$effect(() => {
    runtime.header.title = "Notifications";
    runtime.header.onback = () => {
        if (window.history.length > 1) window.history.back();
        else goto("/settings");
    };
    return () => {
        runtime.header.onback = undefined;
    };
});

async function refreshState() {
    try {
        enabled = await isPermissionGranted();
    } catch {
        enabled = false;
    }
}

onMount(async () => {
    globalState = getContext<() => GlobalState>("globalState")();
    await refreshState();
});

async function toggle() {
    if (!globalState || working) return;
    working = true;
    hint = null;

    const wasEnabled = enabled;

    try {
        if (wasEnabled) {
            // OS-level permission can only be revoked from the device's own
            // settings — the notifications plugin can't disable it from JS on
            // either iOS or Android. Open the app's settings page directly so
            // the user lands one tap away from the notifications switch.
            await openAppSettings();
            return;
        }

        // Off → ask. First call shows the OS prompt; subsequent calls after a
        // previous denial silently return "denied" on both platforms. If we
        // can't flip to granted that way, jump straight to system settings.
        const svc = NotificationService.getInstance();
        const vault = await globalState.vaultController.vault;
        const ename = vault?.ename;
        if (ename) {
            await svc.registerDevice(ename);
        } else {
            await svc.requestPermissions();
        }
        await refreshState();

        if (!enabled) {
            await openAppSettings();
        }
    } catch (err) {
        console.error("[settings/notifications] toggle failed:", err);
        hint = "Something went wrong. Please try again.";
    } finally {
        working = false;
    }
}
</script>

<main class="flex flex-col gap-4 mt-6">
    <button
        type="button"
        onclick={toggle}
        disabled={working}
        role="switch"
        aria-checked={enabled}
        class="w-full flex items-center gap-3 active:opacity-70 text-left disabled:opacity-60 disabled:active:opacity-60"
    >
        <div
            class="w-12 h-12 rounded-2xl bg-white flex items-center justify-center shrink-0 shadow-card overflow-hidden"
        >
            <HugeiconsIcon
                icon={Notification02Icon}
                size={24}
                color="var(--color-black-900)"
                strokeWidth={2}
            />
        </div>

        <div class="flex-1 min-w-0">
            <p class="text-base font-semibold text-black-900">
                Allow notifications
            </p>
            <p class="text-sm text-black-500 mt-0.5">
                {#if enabled}
                    You'll be notified about new messages and requests.
                {:else}
                    Get notified when there's activity on your eVault.
                {/if}
            </p>
        </div>

        <span
            class="relative box-content h-7 w-12 shrink-0 rounded-full border transition-colors {enabled
                ? 'bg-primary border-primary'
                : 'bg-black-100 border-black-300'}"
            aria-hidden="true"
        >
            <span
                class="absolute top-1/2 left-0.5 -translate-y-1/2 h-6 w-6 rounded-full bg-white shadow transition-transform {enabled
                    ? 'translate-x-5'
                    : 'translate-x-0'}"
            ></span>
        </span>
    </button>

    {#if hint}
        <p class="text-sm text-black-700" role="status">{hint}</p>
    {/if}
</main>
