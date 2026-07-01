<script lang="ts">
import { Copy01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/svelte";
import { onDestroy } from "svelte";

interface ICopyableENameProps {
    /** The eName to display and copy to the clipboard. */
    ename: string;
    /** Small caption shown above the eName. */
    label?: string;
}

const { ename, label = "Existing eVault eName" }: ICopyableENameProps =
    $props();

// Brief inline confirmation after a copy. Shown in-place rather than via the
// app Toast because this box lives inside a bottom sheet — a bottom toast would
// render behind/over the sheet.
let copied = $state(false);
let resetTimer: ReturnType<typeof setTimeout> | undefined;

async function copy() {
    try {
        await navigator.clipboard.writeText(ename);
        copied = true;
        clearTimeout(resetTimer);
        resetTimer = setTimeout(() => {
            copied = false;
        }, 2000);
    } catch (error) {
        console.error("Failed to copy eName:", error);
    }
}

onDestroy(() => clearTimeout(resetTimer));
</script>

<div class="rounded-xl bg-gray-50 border border-gray-200 p-4">
    <div class="flex items-center justify-between gap-2 mb-1">
        <p class="text-xs text-black-500">{label}</p>
        {#if copied}
            <span
                class="text-xs font-medium text-success-900"
                aria-live="polite"
            >
                Copied!
            </span>
        {/if}
    </div>
    <div class="flex items-start justify-between gap-3">
        <p
            class="font-mono text-sm font-medium text-black-900 break-all flex-1 min-w-0"
        >
            {ename}
        </p>
        <button
            type="button"
            onclick={copy}
            aria-label="Copy eName"
            class="shrink-0 text-black-500 active:opacity-60"
        >
            <HugeiconsIcon icon={Copy01Icon} size={18} strokeWidth={2} />
        </button>
    </div>
</div>
