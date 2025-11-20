<script lang="ts">
import { cn } from "$lib/utils";
import { CupertinoPane } from "cupertino-pane";
import type { Snippet } from "svelte";
import { useSwipe } from "svelte-gestures";
import type { HTMLAttributes } from "svelte/elements";
import type { SwipeCustomEvent } from "svelte-gestures";

interface IDrawerProps extends HTMLAttributes<HTMLDivElement> {
    isPaneOpen?: boolean;
    children?: Snippet;
    handleSwipe?: (isOpen: boolean | undefined) => void;
    dismissible?: boolean;
}

let drawerElem: HTMLDivElement;
let pane: CupertinoPane;

let {
    isPaneOpen = $bindable(),
    children = undefined,
    handleSwipe,
    dismissible = true,
    ...restProps
}: IDrawerProps = $props();

const handleDrawerSwipe = (event: SwipeCustomEvent) => {
    if (event.detail.direction === "down") {
        handleSwipe?.(isPaneOpen);
    }
};

const { swipe } = useSwipe(handleDrawerSwipe, () => ({
    timeframe: 300,
    minSwipeDistance: 60,
}), undefined, true);

// Disabled click outside behavior to prevent white screen issues
// const handleClickOutside = () => {
//     pane?.destroy({ animate: true });
//     isPaneOpen = false;
// };

// Initialize pane only once when element is available
$effect(() => {
    if (!drawerElem) return;
    pane = new CupertinoPane(drawerElem, {
        fitHeight: true,
        backdrop: true,
        backdropOpacity: dismissible ? 0.5 : 0.8,
        backdropBlur: true,
        bottomClose: dismissible,
        buttonDestroy: false,
        showDraggable: dismissible,
        upperThanTop: true,
        breaks: {
            bottom: { enabled: true, height: 250 },
        },
        initialBreak: "bottom",
    });

    return () => pane?.destroy();
});

// Handle open/close state separately
$effect(() => {
    if (!pane) return;

    if (isPaneOpen) {
        pane.present({ animate: true });
    } else {
        pane.destroy({ animate: true });
    }
});
</script>

<div
    {...restProps}
    use:swipe
    bind:this={drawerElem}
    class={cn(restProps.class)}
>
    <div class="px-6">
        {@render children?.()}
    </div>
</div>

<style>
    :global(.pane) {
        width: 95% !important;
        max-height: 600px !important;
        min-height: 250px !important;
        height: auto !important;
        position: fixed !important;
        bottom: 30px !important;
        left: 50% !important;
        transform: translateX(-50%) !important;
        border-radius: 32px !important;
        padding-block-start: 50px !important;
        padding-block-end: 20px !important;
        background-color: var(--color-white) !important;
        overflow-y: auto !important; /* vertical scroll if needed */
        overflow-x: hidden !important; /* prevent sideways scroll */
        -webkit-overflow-scrolling: touch; /* smooth scrolling on iOS */
    }

    :global(.move) {
        display: none !important;
        margin-block: 6px !important;
    }
</style>
