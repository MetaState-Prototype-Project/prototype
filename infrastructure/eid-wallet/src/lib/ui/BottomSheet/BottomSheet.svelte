<script lang="ts">
import { cn } from "$lib/utils";
import type { Snippet } from "svelte";
import type { HTMLAttributes } from "svelte/elements";

interface BottomSheetProps extends HTMLAttributes<HTMLDivElement> {
    isOpen?: boolean;
    dismissible?: boolean;
    fullScreen?: boolean;
    children?: Snippet;
    onOpenChange?: (value: boolean) => void;
}

let {
    isOpen = $bindable(false),
    dismissible = true,
    fullScreen = false,
    children = undefined,
    onOpenChange,
    ...restProps
}: BottomSheetProps = $props();

let lastReportedOpen = isOpen;

function handleClose() {
    if (!dismissible) return;
    isOpen = false;
    onOpenChange?.(false);
}

$effect(() => {
    if (isOpen !== lastReportedOpen) {
        lastReportedOpen = isOpen;
        onOpenChange?.(isOpen);
    }
});
</script>

{#if isOpen}
    <div
        class="fixed inset-0 z-40 bg-black/40"
        aria-hidden="true"
        onclick={handleClose}
    ></div>
    <div
        {...restProps}
        role="dialog"
        aria-modal="true"
        class={cn(
            fullScreen
                ? "fixed inset-0 z-50 bg-white shadow-xl flex flex-col gap-4 overflow-hidden"
                : "fixed inset-x-0 bottom-0 z-50 bg-white rounded-t-3xl shadow-xl flex flex-col gap-4 max-h-[88svh] overflow-y-auto",
            restProps.class,
        )}
        style={`${fullScreen
            ? "padding: max(1rem, env(safe-area-inset-top)) 1.5rem max(1.5rem, env(safe-area-inset-bottom));"
            : "padding: 1.5rem 1.5rem max(1.5rem, env(safe-area-inset-bottom));"} ${restProps.style ?? ""}`}
    >
        {@render children?.()}
    </div>
{/if}
