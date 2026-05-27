<script lang="ts">
import { goto } from "$app/navigation";
import type { GlobalState } from "$lib/global";
import { runtime } from "$lib/global/runtime.svelte";
import { FaceIdIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/svelte";
import { checkStatus } from "@tauri-apps/plugin-biometric";
import { getContext, onMount } from "svelte";

let globalState: GlobalState | undefined = $state(undefined);
let enabled = $state(false);
let isAvailable = $state<boolean | null>(null);
let error = $state<string | null>(null);

$effect(() => {
    runtime.header.title = "Biometric login";
    runtime.header.onback = () => {
        if (window.history.length > 1) window.history.back();
        else goto("/settings");
    };
    return () => {
        runtime.header.onback = undefined;
    };
});

onMount(async () => {
    globalState = getContext<() => GlobalState>("globalState")();
    if (!globalState) return;
    try {
        const status = await checkStatus();
        isAvailable = status.isAvailable;
    } catch {
        isAvailable = false;
    }
    try {
        enabled = await globalState.securityController.biometricSupport;
    } catch {
        enabled = false;
    }
});

function toggle() {
    if (!globalState) return;
    const next = !enabled;
    if (next && !isAvailable) {
        error = "Biometrics aren't available on this device.";
        return;
    }
    error = null;
    // Snap the visual immediately — the setter's persistence runs async in
    // the background and the prior await-and-re-read pattern made the knob
    // visibly lag a beat behind the tap.
    enabled = next;
    globalState.securityController.biometricSupport = next;
}
</script>

<main class="flex flex-col gap-4 mt-6">
    <button
        type="button"
        onclick={toggle}
        disabled={isAvailable === false}
        role="switch"
        aria-checked={enabled}
        class="w-full flex items-center gap-3 active:opacity-70 text-left disabled:opacity-60 disabled:active:opacity-60"
    >
        <div
            class="w-12 h-12 rounded-2xl bg-white flex items-center justify-center shrink-0 shadow-card overflow-hidden"
        >
            <HugeiconsIcon
                icon={FaceIdIcon}
                size={24}
                color="var(--color-black-900)"
                strokeWidth={2}
            />
        </div>

        <div class="flex-1 min-w-0">
            <p class="text-base font-semibold text-black-900">
                Use biometrics
            </p>
            <p class="text-sm text-black-500 mt-0.5">
                {#if isAvailable === false}
                    Unavailable on this device
                {:else}
                    Unlock the app with your fingerprint or face
                {/if}
            </p>
        </div>

        <!-- box-content keeps the border outside the h-7 track so the
             centered-via-translate knob stays visually centered regardless
             of border width. -->
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

    {#if error}
        <p class="text-danger text-sm font-medium" role="alert">{error}</p>
    {/if}
</main>
