<script lang="ts">
import { cn, portal } from "$lib/utils";
import type { Snippet } from "svelte";
import { cubicOut } from "svelte/easing";
import type { HTMLAttributes } from "svelte/elements";
import { fade, fly } from "svelte/transition";

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
    <!-- Portaled so `fixed` anchors to the viewport, not a transformed ancestor. -->
    <div use:portal>
        <div
            class="fixed inset-0 z-40 bg-black/40"
            aria-hidden="true"
            onclick={handleClose}
            transition:fade={{ duration: 200 }}
        ></div>
        <div
            {...restProps}
            role="dialog"
            aria-modal="true"
            class={cn(
                fullScreen
                    ? "fixed inset-0 z-50 bg-white shadow-xl flex flex-col gap-4"
                    : "fixed inset-x-0 bottom-0 z-50 bg-white rounded-t-3xl shadow-xl flex flex-col gap-4 max-h-[88svh]",
                restProps.class,
            )}
            style={`${
                fullScreen
                    ? "padding: max(1rem, env(safe-area-inset-top)) 1.5rem max(1.5rem, env(safe-area-inset-bottom));"
                    : "padding: 1.5rem 1.5rem max(1.5rem, env(safe-area-inset-bottom));"
            } ${restProps.style ?? ""}`}
            transition:fly={fullScreen
                ? { y: 30, duration: 200, easing: cubicOut }
                : { y: "100%", duration: 280, easing: cubicOut }}
        >
            {@render children?.()}
        </div>
    </div>
{/if}
